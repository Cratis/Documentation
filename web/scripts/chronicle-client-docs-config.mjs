import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
export const webRoot = path.resolve(here, '..');
export const chronicleClientDocsManifestPath = path.join(webRoot, 'chronicle-client-docs.yml');

function requireObject(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`[chronicle-client-docs] ${name} must be an object`);
    }
    return value;
}

function requireArray(value, name) {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`[chronicle-client-docs] ${name} must be a non-empty array`);
    }
    return value;
}

function resolveFromWebRoot(candidate) {
    return path.resolve(webRoot, candidate);
}

function firstExistingPath(candidates, name) {
    const resolved = requireArray(candidates, name).map(resolveFromWebRoot);
    return resolved.find((candidate) => existsSync(candidate)) ?? resolved[resolved.length - 1];
}

function normalizeValidator(key, validator) {
    if (!validator) return null;
    requireObject(validator, `clients.${key}.validator`);

    const command = validator.command;
    if (!command || typeof command !== 'string') {
        throw new Error(`[chronicle-client-docs] clients.${key}.validator.command must be a string`);
    }

    return {
        cwd: firstExistingPath(validator.cwd, `clients.${key}.validator.cwd`),
        command,
        args: Array.isArray(validator.args) ? validator.args.map(String) : [],
        blockedOutput: Array.isArray(validator.blockedOutput) ? validator.blockedOutput.map(String) : [],
    };
}

function normalizeSharedTopics(topics) {
    if (!topics) return [];
    return requireArray(topics, 'sharedTopics').map((topic, index) => {
        const item = requireObject(topic, `sharedTopics[${index}]`);
        if (!item.label || typeof item.label !== 'string') {
            throw new Error(`[chronicle-client-docs] sharedTopics[${index}].label must be a string`);
        }
        if (!item.href || typeof item.href !== 'string') {
            throw new Error(`[chronicle-client-docs] sharedTopics[${index}].href must be a string`);
        }
        return {
            label: item.label,
            href: item.href,
        };
    });
}

function normalizePublicDocsAudit(audit) {
    if (!audit) return { sharedTopicPatterns: [], baselines: {} };
    const node = requireObject(audit, 'publicDocsAudit');
    const baselines = node.baselines ? requireObject(node.baselines, 'publicDocsAudit.baselines') : {};
    return {
        sharedTopicPatterns: Array.isArray(node.sharedTopicPatterns)
            ? node.sharedTopicPatterns.map(String)
            : [],
        baselines: Object.fromEntries(
            Object.entries(baselines).map(([key, value]) => [key, Number(value ?? 0)])
        ),
    };
}

export async function loadChronicleClientDocsConfig() {
    const raw = await fs.readFile(chronicleClientDocsManifestPath, 'utf8');
    const manifest = requireObject(yaml.load(raw), 'manifest');
    const clientsNode = requireObject(manifest.clients, 'clients');

    const clients = Object.entries(clientsNode).map(([key, value]) => {
        const client = requireObject(value, `clients.${key}`);
        const snippets = requireObject(client.snippets, `clients.${key}.snippets`);
        const publicDocs = client.publicDocs ? requireObject(client.publicDocs, `clients.${key}.publicDocs`) : null;

        return {
            key,
            label: client.label ?? key,
            includeByDefault: client.includeByDefault !== false,
            snippetRoot: firstExistingPath(snippets.paths, `clients.${key}.snippets.paths`),
            legacySnippetBaseline: Number(snippets.legacyBaseline ?? 0),
            publicDocs: publicDocs
                ? {
                    key: publicDocs.key ?? key,
                    label: publicDocs.label ?? client.label ?? key,
                    root: firstExistingPath(publicDocs.paths, `clients.${key}.publicDocs.paths`),
                }
                : null,
            validator: normalizeValidator(key, client.validator),
        };
    });

    return {
        manifestPath: chronicleClientDocsManifestPath,
        sharedDocsRoot: firstExistingPath(manifest.sharedDocs?.paths, 'sharedDocs.paths'),
        sharedTopics: normalizeSharedTopics(manifest.sharedTopics),
        publicDocsAudit: normalizePublicDocsAudit(manifest.publicDocsAudit),
        clients,
        snippetClients: clients.map((client) => ({
            key: client.key,
            label: client.label,
            src: client.snippetRoot,
        })),
        defaultSnippetClients: clients
            .filter((client) => client.includeByDefault)
            .map((client) => ({
                key: client.key,
                label: client.label,
                src: client.snippetRoot,
            })),
        publicDocsClients: clients
            .filter((client) => client.publicDocs)
            .map((client) => ({
                key: client.publicDocs.key,
                label: client.publicDocs.label,
                src: client.publicDocs.root,
                clientKey: client.key,
            })),
    };
}
