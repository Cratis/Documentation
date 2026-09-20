// Loads and normalizes `web/variant-docs.yml` — the product-neutral, multi-axis
// variant documentation manifest.
//
// A product declares one or more independent *axes*. Each axis names the
// sync-time macro that expands variant-owned snippets into Starlight <Tabs>,
// the mount point for the variant's own public docs, the sidebar group, and the
// ratchets that keep the shared docs variant-neutral.
//
// The loader is deliberately strict: a malformed manifest throws rather than
// degrading into a silently smaller sync.

import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
export const webRoot = path.resolve(here, '..');
export const variantDocsManifestPath = path.join(webRoot, 'variant-docs.yml');

export const DEFAULT_MESSAGE_PREFIX = 'variant-docs';
export const MANIFEST_VERSION = 2;
export const INJECT_MODES = new Set(['after-bucket', 'into-bucket']);

// Macro names are interpolated into a RegExp, so keep them to a plain
// PascalCase identifier rather than escaping arbitrary user input.
const MACRO_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
// A mount route is a single URL path segment under the product root.
const ROUTE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function createReporter(prefix) {
    const fail = (message) => {
        throw new Error(`[${prefix}] ${message}`);
    };

    return {
        prefix,
        fail,
        object(value, name) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                fail(`${name} must be an object`);
            }
            return value;
        },
        array(value, name) {
            if (!Array.isArray(value) || value.length === 0) {
                fail(`${name} must be a non-empty array`);
            }
            return value;
        },
        string(value, name) {
            if (!value || typeof value !== 'string') {
                fail(`${name} must be a string`);
            }
            return value;
        },
    };
}

function resolveFromWebRoot(candidate) {
    return path.resolve(webRoot, candidate);
}

function firstExistingPath(r, candidates, name) {
    const resolved = r.array(candidates, name).map(resolveFromWebRoot);
    return resolved.find((candidate) => existsSync(candidate)) ?? resolved[resolved.length - 1];
}

function normalizeValidator(r, name, validator) {
    if (!validator) return null;
    r.object(validator, `${name}.validator`);
    r.string(validator.command, `${name}.validator.command`);

    return {
        cwd: firstExistingPath(r, validator.cwd, `${name}.validator.cwd`),
        command: validator.command,
        args: Array.isArray(validator.args) ? validator.args.map(String) : [],
        blockedOutput: Array.isArray(validator.blockedOutput) ? validator.blockedOutput.map(String) : [],
    };
}

function normalizeSharedTopics(r, topics, name) {
    if (!topics) return [];
    return r.array(topics, name).map((topic, index) => {
        const item = r.object(topic, `${name}[${index}]`);
        return {
            label: r.string(item.label, `${name}[${index}].label`),
            href: r.string(item.href, `${name}[${index}].href`),
        };
    });
}

function normalizePublicDocsAudit(r, audit, name) {
    if (!audit) return { sharedTopicPatterns: [], baselines: {} };
    const node = r.object(audit, name);
    const baselines = node.baselines ? r.object(node.baselines, `${name}.baselines`) : {};
    return {
        sharedTopicPatterns: Array.isArray(node.sharedTopicPatterns)
            ? node.sharedTopicPatterns.map(String)
            : [],
        baselines: Object.fromEntries(
            Object.entries(baselines).map(([key, value]) => [key, Number(value ?? 0)])
        ),
    };
}

// Fence languages that count as variant debt in a product's shared docs. An
// entry is either a bare canonical name or `{ name, aliases }`; aliases fold
// into the canonical name so `cs`/`ts` cannot slip past the ratchet under a
// different label. The set is per-axis on purpose: a language that is debt for
// one product's axis can be legitimate shared content for another's.
function normalizeRatchetLanguages(r, entries, name) {
    if (!entries) return { languages: [], aliases: new Map() };
    const list = r.array(entries, name);
    const languages = [];
    const aliases = new Map();

    list.forEach((entry, index) => {
        const item = typeof entry === 'string' ? { name: entry } : r.object(entry, `${name}[${index}]`);
        const language = r.string(item.name, `${name}[${index}].name`);
        const entryAliases = item.aliases
            ? r.array(item.aliases, `${name}[${index}].aliases`).map((alias, aliasIndex) =>
                r.string(alias, `${name}[${index}].aliases[${aliasIndex}]`))
            : [];

        languages.push({ name: language, aliases: entryAliases });
        for (const alias of [language, ...entryAliases]) {
            const key = alias.toLowerCase();
            const existing = aliases.get(key);
            if (existing && existing !== language) {
                r.fail(`${name} alias "${alias}" maps to both "${existing}" and "${language}"`);
            }
            aliases.set(key, language);
        }
    });

    return { languages, aliases };
}

function normalizeMount(r, mount, name) {
    const node = r.object(mount, name);
    const route = r.string(node.route, `${name}.route`);
    if (!ROUTE_PATTERN.test(route)) {
        r.fail(`${name}.route "${route}" must be a single lowercase URL path segment`);
    }
    const landing = r.object(node.landing, `${name}.landing`);
    return {
        route,
        landing: {
            title: r.string(landing.title, `${name}.landing.title`),
            intro: r.string(landing.intro, `${name}.landing.intro`),
            sharedHeading: r.string(landing.sharedHeading, `${name}.landing.sharedHeading`),
            variantHeading: r.string(landing.variantHeading, `${name}.landing.variantHeading`),
        },
    };
}

function normalizeSidebar(r, sidebar, name) {
    const node = r.object(sidebar, name);
    const groupLabel = r.string(node.groupLabel, `${name}.groupLabel`);
    const injectMode = r.string(node.injectMode, `${name}.injectMode`);
    if (!INJECT_MODES.has(injectMode)) {
        r.fail(`${name}.injectMode must be one of ${[...INJECT_MODES].join(', ')}`);
    }

    // `after-bucket` keeps the group a peer of the Diataxis buckets, positioned
    // after `anchorBucket`. `into-bucket` injects before bucketing so the group
    // is absorbed as a child of `targetBucket`.
    const anchorBucket = injectMode === 'after-bucket'
        ? r.string(node.anchorBucket, `${name}.anchorBucket`)
        : null;
    const targetBucket = injectMode === 'into-bucket'
        ? r.string(node.targetBucket, `${name}.targetBucket`)
        : null;

    return { groupLabel, injectMode, anchorBucket, targetBucket };
}

function normalizeVariant(r, key, value, name) {
    const variant = r.object(value, name);
    // `snippets` is optional so a variant can be mounted before it owns any
    // shared-page snippets. The inverse is already legitimate — Chronicle's
    // `java` contributes snippets and mounts no docs of its own — and a variant
    // that publishes its own docs but has not yet been folded into the shared
    // pages is the same situation from the other side. A variant with neither
    // contributes nothing at all, which is a configuration mistake.
    const snippets = variant.snippets ? r.object(variant.snippets, `${name}.snippets`) : null;
    const publicDocs = variant.publicDocs ? r.object(variant.publicDocs, `${name}.publicDocs`) : null;
    if (!snippets && !publicDocs) {
        r.fail(`${name} declares neither snippets nor publicDocs, so it contributes nothing`);
    }

    return {
        key,
        label: variant.label ?? key,
        snippetRoot: snippets ? firstExistingPath(r, snippets.paths, `${name}.snippets.paths`) : null,
        legacySnippetBaseline: Number(snippets?.legacyBaseline ?? 0),
        publicDocs: publicDocs
            ? {
                key: publicDocs.key ?? key,
                label: publicDocs.label ?? variant.label ?? key,
                root: firstExistingPath(r, publicDocs.paths, `${name}.publicDocs.paths`),
            }
            : null,
        validator: normalizeValidator(r, name, variant.validator),
    };
}

function normalizeAxis(r, productKey, axisKey, value, name) {
    const node = r.object(value, name);
    const macro = r.string(node.macro, `${name}.macro`);
    if (!MACRO_PATTERN.test(macro)) {
        r.fail(`${name}.macro "${macro}" must be a plain component identifier`);
    }
    const syncKey = r.string(node.syncKey, `${name}.syncKey`);
    const variantsNode = r.object(node.variants, `${name}.variants`);
    const variantEntries = Object.entries(variantsNode);
    if (!variantEntries.length) {
        r.fail(`${name}.variants must declare at least one variant`);
    }

    const variants = variantEntries.map(([key, variant]) =>
        normalizeVariant(r, key, variant, `${name}.variants.${key}`));
    const { languages, aliases } = normalizeRatchetLanguages(r, node.ratchetLanguages, `${name}.ratchetLanguages`);

    return {
        key: axisKey,
        productKey,
        macro,
        syncKey,
        mount: normalizeMount(r, node.mount, `${name}.mount`),
        sidebar: normalizeSidebar(r, node.sidebar, `${name}.sidebar`),
        ratchetLanguages: languages,
        ratchetLanguageAliases: aliases,
        sharedTopics: normalizeSharedTopics(r, node.sharedTopics, `${name}.sharedTopics`),
        variants,
        // Only variants that own a snippet root can contribute a tab. A
        // mount-only variant is skipped here rather than producing an empty tab.
        snippetVariants: variants
            .filter((variant) => variant.snippetRoot)
            .map((variant) => ({
                key: variant.key,
                label: variant.label,
                src: variant.snippetRoot,
            })),
        publicDocsVariants: variants
            .filter((variant) => variant.publicDocs)
            .map((variant) => ({
                key: variant.publicDocs.key,
                label: variant.publicDocs.label,
                src: variant.publicDocs.root,
                variantKey: variant.key,
            })),
    };
}

function normalizeProduct(r, productKey, value, name) {
    const node = r.object(value, name);
    const axesNode = r.object(node.axes, `${name}.axes`);
    const axisEntries = Object.entries(axesNode);
    if (!axisEntries.length) {
        r.fail(`${name}.axes must declare at least one axis`);
    }

    const axes = axisEntries.map(([axisKey, axis]) =>
        normalizeAxis(r, productKey, axisKey, axis, `${name}.axes.${axisKey}`));

    // Starlight syncs tab selection by label within one flat localStorage
    // namespace, so two axes sharing a syncKey would cross-drive each other's
    // tab selection.
    const seenSyncKeys = new Map();
    for (const axis of axes) {
        if (seenSyncKeys.has(axis.syncKey)) {
            r.fail(
                `${name}.axes.${axis.key}.syncKey "${axis.syncKey}" is already used by ` +
                `${name}.axes.${seenSyncKeys.get(axis.syncKey)}; each axis needs its own syncKey`
            );
        }
        seenSyncKeys.set(axis.syncKey, axis.key);
    }

    const seenRoutes = new Map();
    for (const axis of axes) {
        const route = axis.mount.route;
        if (seenRoutes.has(route)) {
            r.fail(
                `${name}.axes.${axis.key}.mount.route "${route}" is already used by ` +
                `${name}.axes.${seenRoutes.get(route)}`
            );
        }
        seenRoutes.set(route, axis.key);
    }

    return {
        key: productKey,
        sharedDocsRoot: firstExistingPath(r, node.sharedDocs?.paths, `${name}.sharedDocs.paths`),
        publicDocsAudit: normalizePublicDocsAudit(r, node.publicDocsAudit, `${name}.publicDocsAudit`),
        axes,
        axesByKey: new Map(axes.map((axis) => [axis.key, axis])),
    };
}

/**
 * Loads the variant documentation manifest.
 *
 * @param {object} [options]
 * @param {string} [options.manifestPath] Alternate manifest (fixtures/tests).
 * @param {string} [options.messagePrefix] Prefix for validation error messages.
 */
export async function loadVariantDocsConfig(options = {}) {
    const manifestPath = options.manifestPath
        ? path.resolve(webRoot, options.manifestPath)
        : variantDocsManifestPath;
    const r = createReporter(options.messagePrefix ?? DEFAULT_MESSAGE_PREFIX);

    const raw = await fs.readFile(manifestPath, 'utf8');
    const manifest = r.object(yaml.load(raw), 'manifest');
    if (Number(manifest.version) !== MANIFEST_VERSION) {
        r.fail(`manifest.version must be ${MANIFEST_VERSION}, got ${manifest.version ?? '(missing)'}`);
    }

    const productsNode = r.object(manifest.products, 'products');
    const productEntries = Object.entries(productsNode);
    if (!productEntries.length) {
        r.fail('products must declare at least one product');
    }

    const products = productEntries.map(([key, product]) =>
        normalizeProduct(r, key, product, `products.${key}`));
    const productsByKey = new Map(products.map((product) => [product.key, product]));
    const axes = products.flatMap((product) => product.axes);

    return {
        manifestPath,
        version: MANIFEST_VERSION,
        products,
        productsByKey,
        axes,
        getProduct(key) {
            return productsByKey.get(key) ?? null;
        },
        axesFor(productKey) {
            return productsByKey.get(productKey)?.axes ?? [];
        },
        getAxis(productKey, axisKey) {
            return productsByKey.get(productKey)?.axesByKey.get(axisKey) ?? null;
        },
        // Every configured snippet folder basename, so the content sync and the
        // audits can skip snippet roots without hard-coding their names.
        snippetRootBasenames: new Set(
            axes.flatMap((axis) => axis.variants
                .filter((variant) => variant.snippetRoot)
                .map((variant) => path.basename(variant.snippetRoot)))
        ),
        mountRoutesFor(productKey) {
            return new Set((productsByKey.get(productKey)?.axes ?? []).map((axis) => axis.mount.route));
        },
        // The public-docs source folders that live *inside* the product's own
        // shared docs tree. Those are mounted by the variant pass, so the shared
        // walk must not also emit them.
        //
        // This is deliberately keyed on the source folder rather than the mount
        // route. A route can name a folder the product authors itself: Chronicle's
        // `clients/` holds nothing but the mounted `dotnet/`, but a product whose
        // route is `backend/` keeps its own pages there, and skipping the whole
        // route would silently drop every one of them.
        nestedPublicDocRootsFor(productKey) {
            const product = productsByKey.get(productKey);
            if (!product) return new Set();
            const sharedRoot = path.resolve(product.sharedDocsRoot);
            const nested = new Set();
            for (const axis of product.axes) {
                for (const variant of axis.variants) {
                    if (!variant.publicDocs) continue;
                    const root = path.resolve(variant.publicDocs.root);
                    if (root !== sharedRoot && root.startsWith(sharedRoot + path.sep)) nested.add(root);
                }
            }
            return nested;
        },
    };
}
