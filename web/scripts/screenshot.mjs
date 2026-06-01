// Headless-Chrome screenshot tool for visual QA of the docs site.
//
// shot-scraper/Playwright aren't dependencies here, but Chrome usually is. This
// drives the system Chrome over the DevTools Protocol so you can capture a page
// in LIGHT or DARK (plain `--screenshot` only gives the OS default), full-page,
// with client-side rendering settled.
//
// Usage:
//   node scripts/screenshot.mjs <url> <out.png> [light|dark] [width]
//   node scripts/screenshot.mjs http://localhost:4321/chronicle/ /tmp/c.png dark 1440
//
// Crop/zoom afterwards with the `sharp` already in node_modules:
//   node -e "require('sharp')('in.png').extract({left,top,width,height}).resize({width:1400}).toFile('out.png')"
//
// Run instances serially — parallel runs collide on the debug port.

import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';

const [url, out, scheme = 'dark', width = '1440'] = process.argv.slice(2);
if (!url || !out) {
    console.error('Usage: node scripts/screenshot.mjs <url> <out.png> [light|dark] [width]');
    process.exit(1);
}
const W = parseInt(width, 10);
const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
    const candidates = [
        process.env.CHROME_PATH,
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
    ].filter(Boolean);
    return candidates.find((c) => existsSync(c));
}

const chromePath = findChrome();
if (!chromePath) {
    console.error('No Chrome found. Set CHROME_PATH.');
    process.exit(1);
}

const chrome = spawn(chromePath, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    '--force-color-profile=srgb', `--user-data-dir=/tmp/cratis-screenshot-${PORT}`,
    `--window-size=${W},1200`, 'about:blank',
], { stdio: 'ignore' });

let ws;
try {
    let target;
    for (let i = 0; i < 80; i++) {
        try {
            const r = await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: 'PUT' });
            target = await r.json();
            break;
        } catch { await sleep(250); }
    }
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); } };
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

    await send('Page.enable');
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    const events = [];
    ws.onmessage = ((orig) => (m) => { const msg = JSON.parse(m.data); if (msg.method) events.push(msg.method); orig(m); })(ws.onmessage);
    await send('Page.navigate', { url });
    await sleep(3500); // let client-side rendering + fonts settle
    const { cssContentSize } = await send('Page.getLayoutMetrics');
    const h = Math.min(Math.ceil(cssContentSize.height), 12000);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: h, scale: 1 } });
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log(`saved ${out} (${W}x${h}, ${scheme})`);
} finally {
    try { ws && ws.close(); } catch { /* ignore */ }
    chrome.kill('SIGKILL');
}
