<style>
/* ============================================================
   Cratis Landing Page
   ============================================================ */

.cratis-landing {
    font-family: 'Roboto', 'Segoe UI', sans-serif;
}

/* ---------- HERO ---------- */
.cratis-hero {
    text-align: center;
    padding: 80px 30px 60px;
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0c1445 100%);
    border-radius: 16px;
    margin-bottom: 56px;
    position: relative;
    overflow: hidden;
}

.cratis-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at 25% 50%, rgba(99,102,241,0.18) 0%, transparent 55%),
        radial-gradient(circle at 75% 50%, rgba(139,92,246,0.13) 0%, transparent 55%);
    animation: heroGlow 8s ease-in-out infinite alternate;
    pointer-events: none;
}

@keyframes heroGlow {
    0%   { opacity: 0.7; transform: scale(1); }
    100% { opacity: 1;   transform: scale(1.05); }
}

.cratis-hero-logo {
    width: 280px;
    max-width: 75%;
    height: auto;
    margin-bottom: 24px;
    filter: brightness(0) invert(1);
    position: relative;
    z-index: 1;
    box-shadow: none;
    border-radius: 0;
}

.cratis-hero h1 {
    color: #ffffff !important;
    font-size: 2.4rem;
    font-weight: 700;
    margin-bottom: 14px;
    position: relative;
    z-index: 1;
    border-bottom: none !important;
}

.cratis-hero p.cratis-tagline {
    color: rgba(255,255,255,0.82);
    font-size: 1.15rem;
    max-width: 580px;
    margin: 0 auto 36px;
    line-height: 1.75;
    position: relative;
    z-index: 1;
}

.cratis-hero-ctas {
    display: flex;
    gap: 14px;
    justify-content: center;
    flex-wrap: wrap;
    position: relative;
    z-index: 1;
}

.cratis-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 11px 26px;
    border-radius: 40px;
    font-weight: 600;
    font-size: 0.95rem;
    text-decoration: none !important;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    cursor: pointer;
    border: none;
}

.cratis-btn-primary {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #ffffff !important;
    box-shadow: 0 4px 16px rgba(99,102,241,0.42);
}

.cratis-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 7px 22px rgba(99,102,241,0.6);
    color: #ffffff !important;
}

.cratis-btn-ghost {
    background: rgba(255,255,255,0.1);
    color: #ffffff !important;
    border: 1px solid rgba(255,255,255,0.28);
    backdrop-filter: blur(8px);
}

.cratis-btn-ghost:hover {
    background: rgba(255,255,255,0.2);
    transform: translateY(-2px);
    color: #ffffff !important;
}

/* ---------- SECTION HEADERS ---------- */
.cratis-section-header {
    margin-bottom: 32px;
}

.cratis-section-header h2 {
    font-size: 1.9rem;
    font-weight: 700;
    margin-bottom: 6px;
    border-bottom: none !important;
}

.cratis-section-header p {
    color: var(--bs-secondary-color, #6c757d);
    font-size: 1.05rem;
    margin: 0;
}

/* ---------- SCROLL HINT ---------- */
.cratis-scroll-hint {
    text-align: center;
    margin-bottom: 48px;
    color: var(--bs-secondary-color, #6c757d);
    font-size: 0.9rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}

.cratis-scroll-hint-arrow {
    font-size: 1.6rem;
    animation: bounceDown 2s ease-in-out infinite;
    line-height: 1;
}

@keyframes bounceDown {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(6px); }
}

/* ---------- GETTING STARTED ---------- */
.cratis-getting-started {
    margin-bottom: 64px;
}

.cratis-steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
    gap: 22px;
}

.cratis-step-card {
    background: var(--bs-body-bg, #fff);
    border: 1px solid var(--bs-border-color, #dee2e6);
    border-radius: 14px;
    padding: 26px;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.cratis-step-card:hover {
    box-shadow: 0 6px 24px rgba(0,0,0,0.10);
    transform: translateY(-2px);
}

.step-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    border-radius: 50%;
    font-weight: 700;
    font-size: 0.95rem;
    margin-bottom: 14px;
    box-shadow: none;
}

.cratis-step-card h3 {
    font-size: 1.05rem;
    font-weight: 600;
    margin-bottom: 6px;
}

.cratis-step-card p {
    color: var(--bs-secondary-color, #6c757d);
    font-size: 0.88rem;
    margin-bottom: 12px;
    line-height: 1.6;
}

.cratis-code {
    background: #0f172a;
    color: #e2e8f0;
    border-radius: 8px;
    padding: 10px 14px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 0.83rem;
    overflow-x: auto;
    margin-bottom: 6px;
    position: relative;
    box-shadow: none;
}

.cratis-code .cmd-dollar {
    color: #6366f1;
    user-select: none;
    margin-right: 6px;
}

.cratis-copy-btn {
    position: absolute;
    top: 7px;
    right: 7px;
    background: rgba(255,255,255,0.1);
    border: none;
    color: #94a3b8;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 0.72rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    font-family: inherit;
}

.cratis-copy-btn:hover {
    background: rgba(255,255,255,0.22);
    color: #ffffff;
}

/* ---------- ARCHITECTURE STACK ---------- */
.cratis-architecture {
    margin-bottom: 64px;
}

.cratis-stack {
    max-width: 680px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
}

/* Each box */
.cratis-box {
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.10);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
    user-select: none;
}

.cratis-box:hover {
    transform: translateY(-3px) scale(1.01);
    box-shadow: 0 10px 30px rgba(0,0,0,0.18);
}

.cratis-box-header {
    padding: 18px 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: filter 0.2s ease;
}

.cratis-box:hover .cratis-box-header {
    filter: brightness(1.08);
}

.cratis-box-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.cratis-box-icon {
    font-size: 1.7rem;
    line-height: 1;
    box-shadow: none;
    border-radius: 0;
}

.cratis-box-title {
    color: #ffffff;
    font-size: 1.2rem;
    font-weight: 700;
    margin: 0;
    line-height: 1.2;
}

.cratis-box-desc {
    color: rgba(255,255,255,0.78);
    font-size: 0.78rem;
    margin: 2px 0 0;
    line-height: 1.3;
}

.cratis-box-toggle {
    color: rgba(255,255,255,0.85);
    font-size: 1.1rem;
    line-height: 1;
    transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
    flex-shrink: 0;
}

.cratis-box.is-open .cratis-box-toggle {
    transform: rotate(180deg);
}

.coming-soon-pill {
    display: inline-block;
    background: rgba(255,255,255,0.18);
    color: rgba(255,255,255,0.9);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 2px 9px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.3);
    margin-left: 8px;
    vertical-align: middle;
}

/* Collapsible body */
.cratis-box-body {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.5s cubic-bezier(0.4,0,0.2,1);
    background: var(--bs-body-bg, #fff);
    border: 1px solid var(--bs-border-color, #dee2e6);
    border-top: none;
    border-radius: 0 0 14px 14px;
}

.cratis-box.is-open .cratis-box-body {
    max-height: 420px;
}

.cratis-box-body-inner {
    padding: 18px 22px 10px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 6px 12px;
}

@keyframes featurePop {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
}

.cratis-feature {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    color: var(--bs-body-color);
    padding: 3px 0;
    animation: featurePop 0.35s ease both;
}

.cratis-feature-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: none;
}

.cratis-box-body-footer {
    padding: 8px 22px 16px;
}

.cratis-box-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.83rem;
    font-weight: 600;
    text-decoration: none !important;
    padding: 6px 15px;
    border-radius: 20px;
    transition: transform 0.2s ease, background 0.2s ease;
    color: #ffffff !important;
}

.cratis-box-link:hover {
    transform: translateX(3px);
    color: #ffffff !important;
}

/* Stack arrow connector */
.cratis-stack-arrow {
    display: flex;
    justify-content: center;
    padding: 4px 0;
    color: var(--bs-secondary-color, #aaa);
    font-size: 1.3rem;
    animation: bounceDown 2s ease-in-out infinite;
    line-height: 1;
}
</style>

<div class="cratis-landing">

<!-- ========== HERO ========== -->
<div class="cratis-hero">
    <svg class="cratis-hero-logo" width="600pt" height="328pt" viewBox="0 0 600 328" preserveAspectRatio="xMidYMid meet" aria-label="Cratis logo">
        <g transform="translate(0,328) scale(0.1,-0.1)" stroke="none">
            <path d="M974 2789 c-319 -182 -592 -343 -607 -358 -16 -14 -34 -35 -40 -46 -8 -14 -10 -229 -9 -735 l3 -715 23 -35 c18 -26 74 -64 222 -151 110 -64 374 -219 589 -344 214 -126 400 -231 413 -233 13 -3 31 3 42 13 19 17 20 33 20 307 0 233 -3 294 -15 317 -10 21 -93 74 -327 211 -172 101 -324 194 -338 207 l-25 23 0 401 0 401 27 23 c14 12 161 100 327 194 177 101 310 184 325 202 l26 31 0 293 c0 318 -1 325 -55 325 -12 0 -283 -149 -601 -331z"/>
            <path d="M4830 2314 c-62 -23 -90 -58 -90 -115 0 -22 10 -41 34 -65 30 -30 40 -34 85 -34 59 0 95 19 117 61 25 49 12 105 -32 134 -25 16 -91 27 -114 19z"/>
            <path d="M4310 2080 l0 -80 -55 0 -55 0 0 -80 0 -80 55 0 55 0 0 -168 c0 -164 1 -170 28 -223 22 -44 36 -58 81 -81 45 -24 66 -28 131 -28 77 0 134 12 157 34 8 8 5 28 -14 79 -21 55 -29 67 -42 61 -9 -4 -35 -9 -57 -12 -34 -3 -46 1 -63 19 -19 21 -21 34 -21 171 l0 148 80 0 80 0 0 80 0 80 -80 0 -80 0 0 80 0 80 -100 0 -100 0 0 -80z"/>
            <path d="M1495 2019 c-178 -98 -219 -126 -237 -157 -15 -26 -18 -57 -18 -215 0 -175 1 -186 23 -218 30 -45 326 -219 372 -219 34 0 319 157 361 199 24 23 24 26 24 230 l0 207 -27 31 c-39 44 -319 203 -358 203 -19 0 -73 -24 -140 -61z"/>
            <path d="M2635 2006 c-110 -35 -200 -116 -230 -207 -22 -64 -22 -180 -1 -238 35 -96 124 -178 225 -208 79 -23 231 -15 291 16 53 27 106 75 126 113 l14 27 -74 40 c-40 23 -76 41 -79 41 -2 0 -22 -18 -44 -39 -30 -30 -50 -41 -86 -46 -135 -20 -230 129 -167 261 49 101 177 119 259 37 l35 -35 69 33 c37 19 72 39 78 45 13 15 -41 87 -90 119 -21 15 -60 33 -87 41 -58 17 -184 17 -239 0z"/>
            <path d="M3405 2008 c-16 -6 -47 -22 -67 -35 l-38 -23 0 30 0 30 -100 0 -100 0 0 -330 0 -330 99 0 99 0 4 183 c3 159 6 187 24 222 25 49 89 85 151 85 l43 0 0 90 0 90 -42 -1 c-24 0 -56 -5 -73 -11z"/>
            <path d="M3705 2007 c-61 -16 -145 -55 -145 -68 0 -7 56 -126 64 -136 1 -1 25 9 53 23 61 31 155 42 206 25 43 -14 77 -53 77 -87 0 -24 -1 -24 -108 -24 -173 0 -262 -34 -302 -116 -45 -92 -9 -203 83 -255 33 -18 62 -24 128 -27 97 -5 144 6 189 45 l30 25 0 -31 0 -31 96 0 96 0 -5 228 c-2 125 -10 243 -16 263 -19 63 -65 115 -128 145 -51 25 -70 29 -163 31 -60 1 -127 -3 -155 -10z m255 -425 c0 -71 -86 -123 -168 -100 -42 12 -61 33 -62 69 0 25 21 51 50 62 8 3 52 6 98 6 l82 1 0 -38z"/>
            <path d="M5207 2006 c-66 -19 -119 -58 -146 -107 -19 -34 -23 -52 -19 -109 3 -60 8 -73 33 -101 42 -44 94 -65 210 -84 109 -19 145 -35 145 -66 0 -55 -151 -63 -272 -15 -36 14 -67 26 -69 26 -9 0 -73 -140 -67 -146 4 -3 37 -17 75 -31 90 -34 269 -44 353 -19 119 35 172 95 172 194 0 124 -50 164 -249 202 -56 10 -112 24 -123 30 -31 17 -22 51 20 73 45 23 149 17 216 -12 26 -12 48 -21 51 -21 5 0 63 129 63 140 0 5 -26 19 -57 31 -73 28 -261 36 -336 15z"/>
            <path d="M4760 1680 l0 -330 100 0 100 0 0 330 0 330 -100 0 -100 0 0 -330z"/>
        </g>
    </svg>
    <h1>Build better software, faster.</h1>
    <p class="cratis-tagline">Cratis is a suite of open-source libraries and tools for building robust, event-driven .NET applications — with productivity, compliance, and maintainability at its core.</p>
    <div class="cratis-hero-ctas">
        <a href="docs/Chronicle/" class="cratis-btn cratis-btn-primary">🚀 Get Started</a>
        <a href="https://github.com/cratis" class="cratis-btn cratis-btn-ghost" target="_blank" rel="noopener">⭐ GitHub</a>
    </div>
</div>

<!-- ========== GETTING STARTED ========== -->
<div class="cratis-getting-started">
    <div class="cratis-section-header">
        <h2>🛠️ Get started in two steps</h2>
        <p>Install the .NET templates and spin up your first Cratis application in minutes.</p>
    </div>
    <div class="cratis-steps">
        <div class="cratis-step-card">
            <div class="step-badge">1</div>
            <h3>Install the Cratis templates</h3>
            <p>Add the official Cratis project templates to your .NET CLI. You only need to do this once.</p>
            <div class="cratis-code" id="cmd1">
                <span class="cmd-dollar">$</span>dotnet new install Cratis.Templates
                <button class="cratis-copy-btn" onclick="cratissCopy('dotnet new install Cratis.Templates', this)">Copy</button>
            </div>
        </div>
        <div class="cratis-step-card">
            <div class="step-badge">2</div>
            <h3>Create your application</h3>
            <p>Scaffold a new Cratis application complete with Chronicle, Arc, and a React frontend — all wired up and ready to go.</p>
            <div class="cratis-code" id="cmd2">
                <span class="cmd-dollar">$</span>dotnet new cratis -n MyApp
                <button class="cratis-copy-btn" onclick="cratissCopy('dotnet new cratis -n MyApp', this)">Copy</button>
            </div>
            <div class="cratis-code" id="cmd3">
                <span class="cmd-dollar">$</span>cd MyApp &amp;&amp; dotnet run
                <button class="cratis-copy-btn" onclick="cratissCopy('cd MyApp && dotnet run', this)">Copy</button>
            </div>
        </div>
    </div>
</div>

<!-- ========== SCROLL HINT ========== -->
<div class="cratis-scroll-hint">
    <span>Explore the Cratis stack</span>
    <span class="cratis-scroll-hint-arrow">⬇</span>
</div>

<!-- ========== ARCHITECTURE STACK ========== -->
<div class="cratis-architecture">
    <div class="cratis-section-header">
        <h2>🏗️ The Cratis stack</h2>
        <p>Click any layer to discover what it offers. Each layer builds on the ones below it.</p>
    </div>

    <div class="cratis-stack">

        <!-- Studio -->
        <div class="cratis-box" id="box-studio" onclick="cratissToggle('box-studio')" role="button" tabindex="0" aria-expanded="false">
            <div class="cratis-box-header" style="background: linear-gradient(135deg, #5b21b6, #7c3aed);">
                <div class="cratis-box-header-left">
                    <span class="cratis-box-icon">🎨</span>
                    <div>
                        <div class="cratis-box-title">Studio <span class="coming-soon-pill">coming soon</span></div>
                        <div class="cratis-box-desc">Visual management & observability for the Cratis ecosystem</div>
                    </div>
                </div>
                <span class="cratis-box-toggle">▼</span>
            </div>
            <div class="cratis-box-body" aria-hidden="true">
                <div class="cratis-box-body-inner">
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#7c3aed;"></span>Visual management interface</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#7c3aed;"></span>Real-time event stream viewer</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#7c3aed;"></span>Event replay &amp; history rewind</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#7c3aed;"></span>Debug application state visually</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#7c3aed;"></span>Manage observers &amp; reactors</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#7c3aed;"></span>Browse &amp; query the event store</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#7c3aed;"></span>Performance dashboards</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#7c3aed;"></span>Multi-tenant overview</div>
                </div>
                <div class="cratis-box-body-footer">
                    <a href="https://cratis.studio" target="_blank" rel="noopener" class="cratis-box-link" style="background: #7c3aed;">🌐 cratis.studio ↗</a>
                </div>
            </div>
        </div>

        <div class="cratis-stack-arrow">⬇</div>

        <!-- Chronicle -->
        <div class="cratis-box" id="box-chronicle" onclick="cratissToggle('box-chronicle')" role="button" tabindex="0" aria-expanded="false">
            <div class="cratis-box-header" style="background: linear-gradient(135deg, #1d4ed8, #2563eb);">
                <div class="cratis-box-header-left">
                    <span class="cratis-box-icon">📜</span>
                    <div>
                        <div class="cratis-box-title">Chronicle</div>
                        <div class="cratis-box-desc">Purpose-built Event Sourcing database for .NET</div>
                    </div>
                </div>
                <span class="cratis-box-toggle">▼</span>
            </div>
            <div class="cratis-box-body" aria-hidden="true">
                <div class="cratis-box-body-inner">
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#2563eb;"></span>Event Sourcing database</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#2563eb;"></span>Automatic event replay</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#2563eb;"></span>Read model projections</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#2563eb;"></span>Multi-tenancy out of the box</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#2563eb;"></span>Observers &amp; reaction system</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#2563eb;"></span>Compliance &amp; GDPR built-in</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#2563eb;"></span>Complete audit trail</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#2563eb;"></span>.NET &amp; TypeScript SDKs</div>
                </div>
                <div class="cratis-box-body-footer">
                    <a href="docs/Chronicle/" class="cratis-box-link" style="background: #2563eb;">📖 Documentation →</a>
                </div>
            </div>
        </div>

        <div class="cratis-stack-arrow">⬇</div>

        <!-- Components -->
        <div class="cratis-box" id="box-components" onclick="cratissToggle('box-components')" role="button" tabindex="0" aria-expanded="false">
            <div class="cratis-box-header" style="background: linear-gradient(135deg, #0e7490, #0891b2);">
                <div class="cratis-box-header-left">
                    <span class="cratis-box-icon">🧩</span>
                    <div>
                        <div class="cratis-box-title">Components</div>
                        <div class="cratis-box-desc">Cratis design system &amp; React UI component library</div>
                    </div>
                </div>
                <span class="cratis-box-toggle">▼</span>
            </div>
            <div class="cratis-box-body" aria-hidden="true">
                <div class="cratis-box-body-inner">
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#0891b2;"></span>React component library</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#0891b2;"></span>Cratis design system</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#0891b2;"></span>Dark &amp; light themes</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#0891b2;"></span>TypeScript-first</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#0891b2;"></span>Accessible by design</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#0891b2;"></span>Storybook integration</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#0891b2;"></span>Consistent UX patterns</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#0891b2;"></span>Tree-shakeable bundles</div>
                </div>
                <div class="cratis-box-body-footer">
                    <a href="docs/Components/" class="cratis-box-link" style="background: #0891b2;">📖 Documentation →</a>
                </div>
            </div>
        </div>

        <div class="cratis-stack-arrow">⬇</div>

        <!-- Arc -->
        <div class="cratis-box" id="box-arc" onclick="cratissToggle('box-arc')" role="button" tabindex="0" aria-expanded="false">
            <div class="cratis-box-header" style="background: linear-gradient(135deg, #047857, #059669);">
                <div class="cratis-box-header-left">
                    <span class="cratis-box-icon">⚡</span>
                    <div>
                        <div class="cratis-box-title">Arc</div>
                        <div class="cratis-box-desc">Opinionated CQRS application framework for ASP.NET Core</div>
                    </div>
                </div>
                <span class="cratis-box-toggle">▼</span>
            </div>
            <div class="cratis-box-body" aria-hidden="true">
                <div class="cratis-box-body-inner">
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#059669;"></span>CQRS application framework</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#059669;"></span>ASP.NET Core integration</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#059669;"></span>Commands &amp; Queries pattern</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#059669;"></span>TypeScript ProxyGenerator</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#059669;"></span>Automatic API generation</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#059669;"></span>Frontend/backend type bridge</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#059669;"></span>MongoDB integration</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#059669;"></span>Validation built-in</div>
                </div>
                <div class="cratis-box-body-footer">
                    <a href="docs/Arc/" class="cratis-box-link" style="background: #059669;">📖 Documentation →</a>
                </div>
            </div>
        </div>

        <div class="cratis-stack-arrow">⬇</div>

        <!-- Fundamentals -->
        <div class="cratis-box" id="box-fundamentals" onclick="cratissToggle('box-fundamentals')" role="button" tabindex="0" aria-expanded="false">
            <div class="cratis-box-header" style="background: linear-gradient(135deg, #b45309, #d97706);">
                <div class="cratis-box-header-left">
                    <span class="cratis-box-icon">🧱</span>
                    <div>
                        <div class="cratis-box-title">Fundamentals</div>
                        <div class="cratis-box-desc">Core utilities, helpers &amp; building blocks for .NET &amp; JS</div>
                    </div>
                </div>
                <span class="cratis-box-toggle">▼</span>
            </div>
            <div class="cratis-box-body" aria-hidden="true">
                <div class="cratis-box-body-inner">
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#d97706;"></span>Core utilities &amp; helpers</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#d97706;"></span>.NET &amp; JavaScript support</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#d97706;"></span>Concepts &amp; value objects</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#d97706;"></span>Type system extensions</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#d97706;"></span>JSON serialization helpers</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#d97706;"></span>Reactive programming support</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#d97706;"></span>Testing utilities</div>
                    <div class="cratis-feature"><span class="cratis-feature-dot" style="background:#d97706;"></span>Extension methods</div>
                </div>
                <div class="cratis-box-body-footer">
                    <a href="docs/Fundamentals/" class="cratis-box-link" style="background: #d97706;">📖 Documentation →</a>
                </div>
            </div>
        </div>

    </div>
</div>

</div><!-- end .cratis-landing -->

<script>
(function () {
    // Toggle box open/closed
    function cratissToggle(id) {
        var box = document.getElementById(id);
        if (!box) return;
        var isOpen = box.classList.contains('is-open');
        box.classList.toggle('is-open', !isOpen);
        box.setAttribute('aria-expanded', String(!isOpen));
        var body = box.querySelector('.cratis-box-body');
        if (body) body.setAttribute('aria-hidden', String(isOpen));
        // Animate features in staggered fashion
        if (!isOpen) {
            var features = box.querySelectorAll('.cratis-feature');
            features.forEach(function (f, i) {
                f.style.animationDelay = (i * 40) + 'ms';
                f.style.animation = 'none';
                void f.offsetWidth; // force reflow to restart CSS animation from the beginning
                f.style.animation = '';
            });
        }
    }
    window.cratissToggle = cratissToggle;

    // Copy to clipboard
    function cratissCopy(text, btn) {
        if (!btn) return;
        var orig = btn.textContent;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function () {
                btn.textContent = 'Copied!';
                setTimeout(function () { btn.textContent = orig; }, 1500);
            }, function () {
                btn.textContent = 'Failed';
                setTimeout(function () { btn.textContent = orig; }, 1500);
            });
        } else {
            // Fallback for browsers without Clipboard API
            try {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                btn.textContent = 'Copied!';
            } catch (e) {
                btn.textContent = 'Failed';
            }
            setTimeout(function () { btn.textContent = orig; }, 1500);
        }
    }
    window.cratissCopy = cratissCopy;

    // Keyboard accessibility for boxes
    document.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList && e.target.classList.contains('cratis-box')) {
            e.preventDefault();
            cratissToggle(e.target.id);
        }
    });
})();
</script>
