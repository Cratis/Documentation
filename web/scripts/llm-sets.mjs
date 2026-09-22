// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// The Starlight plugin renders these from the same content collection as the site.
// Keep sets small enough to select for a single task; the site-wide full export
// remains available for bulk download, not as the default context for a question.
export const LLM_SETS = [
    {
        label: 'Chronicle first steps', product: 'chronicle', area: 'get-started',
        paths: ['chronicle/get-started', 'chronicle/get-started/**'],
    },
    {
        label: 'Chronicle events', product: 'chronicle', area: 'events',
        paths: ['chronicle/events', 'chronicle/events/**'],
    },
    {
        label: 'Chronicle read models', product: 'chronicle', area: 'read-models',
        paths: ['chronicle/read-models', 'chronicle/read-models/**'],
    },
    {
        label: 'Arc first steps', product: 'arc', area: 'tutorial',
        paths: ['arc/tutorial', 'arc/tutorial/**'],
    },
    {
        label: 'Components first steps', product: 'components', area: 'tutorial',
        paths: ['components/tutorial', 'components/tutorial/**'],
    },
];

export const llmSetSlug = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
