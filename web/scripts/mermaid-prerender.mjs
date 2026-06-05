// Build-time Mermaid pre-rendering.
//
// astro-mermaid renders diagrams in the browser, so on diagram pages the page
// is too short during load (scroll restoration lands wrong → flash) and the
// diagram pops in ~100ms later. This remark plugin renders each diagram to SVG
// at build time — using the Chrome already on the machine (and on CI runners),
// with NO new npm dependency — and inlines it, so the SVG ships in the HTML.
// The colors are still themed by cratis.css (the SVG uses the same classes the
// client render does), so light/dark still work.
//
// It degrades gracefully: if Chrome can't be found or a render fails, the
// ```mermaid block is left untouched for astro-mermaid to render client-side
// (the previous behaviour), so the build can never break.

import { spawn } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { visit } from 'unist-util-visit';

const webRoot = new URL('..', import.meta.url);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chooseDebugPort = () => 9300 + Math.floor(Math.random() * 20000);

/** Stable, dependency-free hash for a deterministic per-diagram element id. */
function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

/** Locate a Chrome/Chromium binary across macOS, Linux, and CI. */
function findChrome() {
    const candidates = [
        process.env.CHROME_PATH,
        process.env.PUPPETEER_EXECUTABLE_PATH,
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
    ].filter(Boolean);
    return candidates.find((c) => existsSync(c)) || null;
}

// Mermaid config — must match astro.config.mjs so build-time and any
// client-side fallback measure boxes the same way.
const MERMAID_CONFIG = {
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: "'Inter Variable', sans-serif",
    // useMaxWidth:false gives the SVG explicit px width/height (a known aspect
    // ratio), so the browser reserves its space at first paint — no settle/
    // reflow. cratis.css then makes it responsive (max-width:100%; height:auto).
    flowchart: { padding: 14, nodeSpacing: 55, rankSpacing: 60, useMaxWidth: false },
};

let state = null; // { proc, ws, send, ready } | 'unavailable'
let renderQueue = Promise.resolve();
const cache = new Map();

/** Launch Chrome once and prepare a page with Inter + mermaid loaded. */
async function ensureBrowser() {
    if (state) return state === 'unavailable' ? null : state;

    const chromePath = findChrome();
    if (!chromePath) {
        console.warn('[mermaid-prerender] No Chrome found — diagrams will render client-side. Set CHROME_PATH to enable.');
        state = 'unavailable';
        return null;
    }

    try {
        const port = chooseDebugPort();
        const userDataDir = join(tmpdir(), `cratis-mermaid-prerender-${process.pid}-${port}`);
        const proc = spawn(chromePath, [
            '--headless=new', `--remote-debugging-port=${port}`, '--no-first-run',
            '--no-default-browser-check', '--disable-gpu', '--no-sandbox',
            `--user-data-dir=${userDataDir}`, 'about:blank',
        ], { stdio: 'ignore' });
        proc.unref();

        let target;
        for (let i = 0; i < 80; i++) {
            try {
                const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
                target = await r.json();
                break;
            } catch { await sleep(250); }
        }
        if (!target) throw new Error('devtools endpoint never came up');

        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
        let id = 0;
        const pending = new Map();
        ws.onmessage = (m) => {
            const msg = JSON.parse(m.data);
            if (msg.id && pending.has(msg.id)) {
                const { res, rej } = pending.get(msg.id);
                pending.delete(msg.id);
                msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
            }
        };
        const send = (method, params = {}) =>
            new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });

        await send('Page.enable');
        await send('Runtime.enable');

        // Renderer document: load Inter (so box measurement matches the site) + mermaid.
        const interB64 = readFileSync(new URL('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', webRoot)).toString('base64');
        const mermaidJs = readFileSync(new URL('node_modules/mermaid/dist/mermaid.min.js', webRoot), 'utf8');
        const doc = `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:'Inter Variable';font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${interB64}) format('woff2');}body{font-family:'Inter Variable';}</style></head><body></body></html>`;
        await send('Runtime.evaluate', { expression: `document.open();document.write(${JSON.stringify(doc)});document.close();` });
        await send('Runtime.evaluate', { expression: `document.fonts.load("16px 'Inter Variable'")`, awaitPromise: true });
        await send('Runtime.evaluate', { expression: `document.fonts.ready`, awaitPromise: true });
        await send('Runtime.evaluate', { expression: mermaidJs });
        await send('Runtime.evaluate', { expression: `mermaid.initialize(${JSON.stringify(MERMAID_CONFIG)})` });

        state = { proc, ws, send, userDataDir };
        return state;
    } catch (err) {
        console.warn(`[mermaid-prerender] Chrome setup failed (${err.message}) — diagrams will render client-side.`);
        state = 'unavailable';
        return null;
    }
}

/**
 * Make the rendered SVG responsive AND reserve its space at first paint:
 * width:100% to scale, max-width to cap at natural size, and aspect-ratio from
 * the viewBox so the browser knows the height before layout — no settle/reflow.
 */
function makeResponsive(svg) {
    const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    if (!vb) return svg;
    const [, w, h] = vb;
    return svg.replace(/<svg([^>]*?)>/, (_m, attrs) => {
        const cleaned = attrs.replace(/\s(?:width|height|style)="[^"]*"/g, '');
        return `<svg${cleaned} width="100%" style="max-width:${Math.ceil(parseFloat(w))}px;height:auto;aspect-ratio:${w}/${h};">`;
    });
}

/** Render one diagram source to an SVG string, or null on any failure. */
async function renderDiagram(source) {
    if (cache.has(source)) return cache.get(source);

    // Serialize renders — they share one Chrome page.
    const result = renderQueue.then(async () => {
        const browser = await ensureBrowser();
        if (!browser) return null;
        try {
            const elementId = `mermaid-${hash(source)}`;
            const r = await browser.send('Runtime.evaluate', {
                awaitPromise: true,
                returnByValue: true,
                expression: `(async () => {
                    try { const { svg } = await mermaid.render(${JSON.stringify(elementId)}, ${JSON.stringify(source)}); return svg; }
                    catch (e) { return null; }
                })()`,
            });
            return r?.result?.value ?? null;
        } catch {
            return null;
        }
    });
    renderQueue = result.catch(() => {});
    const raw = await result;
    const svg = raw ? makeResponsive(raw) : null;
    if (svg) cache.set(source, svg);
    return svg;
}

export async function closeBrowser() {
    if (state && state !== 'unavailable') {
        try { state.ws.close(); } catch { /* ignore */ }
        try { state.proc.kill('SIGKILL'); } catch { /* ignore */ }
        try { rmSync(state.userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    state = null;
}

// Make sure Chrome doesn't outlive the build/dev process.
process.once('exit', () => {
    try { state && state !== 'unavailable' && state.proc.kill('SIGKILL'); } catch { /* ignore */ }
    try { state && state !== 'unavailable' && rmSync(state.userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

/**
 * Remark plugin: replace ```mermaid and ```eventmodeling code blocks with a pre-rendered SVG.
 * Runs before astro-mermaid's plugin; anything it can't render is left as a
 * code block for astro-mermaid to handle client-side.
 */
export function remarkMermaidPrerender() {
    return async function transformer(tree) {
        const targets = [];
        visit(tree, 'code', (node, index, parent) => {
            if ((node.lang === 'mermaid' || node.lang === 'eventmodeling') && parent && typeof index === 'number') {
                const source = node.lang === 'eventmodeling'
                    ? `eventmodeling\n\n${node.value}`
                    : node.value;
                targets.push({ node, index, parent, source });
            }
        });
        if (!targets.length) return;

        for (const { node, index, parent, source } of targets) {
            const svg = await renderDiagram(source);
            if (svg) {
                parent.children[index] = {
                    type: 'html',
                    // data-processed marks it done so astro-mermaid's client script skips it;
                    // pre.mermaid keeps cratis.css's diagram theming applying.
                    value: `<pre class="mermaid" data-processed="true" data-prerendered="true">${svg}</pre>`,
                };
            } else if (node.lang === 'eventmodeling') {
                // If Chrome is unavailable, let astro-mermaid render the diagram
                // client-side instead of handing Expressive Code an unknown language.
                node.lang = 'mermaid';
                node.value = source;
            }
            // else: leave the code node — astro-mermaid renders it client-side.
        }
    };
}
