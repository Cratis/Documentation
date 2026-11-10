// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export const LLM_FAMILIES = [
    { id: 'chronicle', label: 'Chronicle', products: ['chronicle', 'chronicle/go', 'chronicle-mcp'] },
    { id: 'arc', label: 'Arc', products: ['arc', 'arc/go'] },
    { id: 'screenplay-stage', label: 'Screenplay and Stage', products: ['screenplay', 'stage', 'prologue'] },
    { id: 'components', label: 'Components', products: ['components'] },
    { id: 'fundamentals', label: 'Fundamentals', products: ['fundamentals', 'fundamentals/go'] },
    {
        id: 'tooling', label: 'Tooling and services',
        products: ['cli', 'templates', 'direct', 'choreography', 'authproxy', 'showrunner', 'prompter', 'contributing', 'architecture', 'eventmodelers-ai/csharp', 'eventmodelers-ai/kotlin', 'eventmodelers-ai/java'],
    },
];

export const familyOf = (productKey) => LLM_FAMILIES.find(family => family.products.includes(productKey));
export const familyRoute = (id) => `/families/${id}/llms-full.txt`;
