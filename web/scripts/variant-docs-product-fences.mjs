// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { applyExemptions } from './variant-docs-site-audit.mjs';

/** Count shared-product fences, exempting only exact, still-present platform examples. */
export function countProductFences(pages, exemptions, scope) {
    const problems = [];
    const directFences = new Map();
    let exemptedFences = 0;

    for (const exemption of exemptions) {
        if (!pages.has(exemption.page)) {
            problems.push(`${scope}.exemptFences: ${exemption.page} is not an audited shared page; remove the stale exemption`);
        }
    }
    for (const [page, fences] of pages) {
        const counted = applyExemptions(page, fences,
            exemptions.filter((entry) => entry.page === page), problems, `${scope}.exemptFences`);
        exemptedFences += fences.length - counted.length;
        const languages = {};
        for (const fence of counted) languages[fence.lang] = (languages[fence.lang] ?? 0) + 1;
        if (counted.length) directFences.set(page, languages);
    }
    return { directFences, exemptedFences, problems };
}
