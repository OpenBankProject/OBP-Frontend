/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
/**
 * Two example landing pages, written the way Opey (or a marketing person) would
 * write them: free HTML + CSS, with live-data tags and behaviours from
 * @obp/shared/landing. Same five tags, two very different looks.
 *
 * Each page scopes its CSS under one wrapper class so it cannot leak.
 */

const EVENT_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 23);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
})();

export const HACKATHON_PAGE = (collectionId: string) => `<style>
  .lp-hack { --obp-accent: #f59e0b; --obp-accent-contrast: #111; --obp-card-bg: #16181d; --obp-card-fg: #f5f5f4; --obp-card-muted: #a3a3a3; --obp-card-border: #2a2d35; --obp-card-radius: 18px; --obp-card-shadow: none;
    background: radial-gradient(1200px 600px at 10% -10%, #3b2f0b 0%, #0b0c10 55%); color: #f5f5f4; font-family: ui-sans-serif, system-ui, sans-serif; padding: 0 0 56px; border-radius: 16px; overflow: hidden; }
  .lp-hack .hero { padding: 72px 40px 48px; }
  .lp-hack .eyebrow { color: #f59e0b; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; font-size: 12px; }
  .lp-hack h1 { font-size: clamp(36px, 6vw, 64px); line-height: 1; margin: 12px 0 16px; letter-spacing: -.02em; }
  .lp-hack .lead { max-width: 60ch; color: #d4d4d4; font-size: 18px; line-height: 1.5; }
  .lp-hack .hero-cta { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-top: 28px; }
  .lp-hack [data-behaviour="countdown"] { background: rgba(255,255,255,.06); border: 1px solid #2a2d35; border-radius: 14px; padding: 14px 18px; }
  .lp-hack .stats { display: flex; gap: 40px; padding: 0 40px 36px; flex-wrap: wrap; }
  .lp-hack .stat-big { font-size: 40px; color: #f59e0b; display: block; }
  .lp-hack .stat-label { color: #a3a3a3; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
  .lp-hack section { padding: 24px 40px; }
  .lp-hack h2 { font-size: 26px; margin: 0 0 16px; }
  .lp-hack .obp-product-card { border-color: transparent; background: linear-gradient(160deg, #1f2128, #121418); }
  .lp-hack .obp-product-card:hover { outline: 2px solid #f59e0b; }
  .lp-hack .obp-product-link { color: #f59e0b; }
  .lp-hack .obp-endpoint { background: #14161b; border-color: #2a2d35; }
  .lp-hack .obp-bank { background: transparent; border-color: #2a2d35; color: #f5f5f4; }
  .lp-hack [data-behaviour="tabs"] nav { display: flex; gap: 8px; margin-bottom: 14px; }
  .lp-hack [data-tab] { background: transparent; color: #a3a3a3; border: 1px solid #2a2d35; border-radius: 999px; padding: 8px 16px; font: inherit; }
  .lp-hack [data-tab].is-active { background: #f59e0b; color: #111; border-color: #f59e0b; }
  .lp-hack [data-panel] { color: #d4d4d4; line-height: 1.6; }
  .lp-hack pre { background: #0b0c10; border: 1px solid #2a2d35; border-radius: 12px; padding: 16px; overflow: auto; color: #fde68a; font-size: 13px; }
  .lp-hack .code-row { display: flex; gap: 12px; align-items: flex-start; }
  .lp-hack [data-behaviour="copy"] { background: #f59e0b; color: #111; border: 0; border-radius: 10px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
  .lp-hack [data-behaviour="copy"].is-copied { background: #22c55e; }
  .lp-hack details { border: 1px solid #2a2d35; border-radius: 12px; padding: 12px 16px; margin-bottom: 8px; }
  .lp-hack summary { cursor: pointer; font-weight: 600; }
  .lp-hack .footer-cta { text-align: center; padding: 40px; }
</style>
<div class="lp-hack obp-landing">
  <header class="hero" data-behaviour="reveal">
    <div class="eyebrow">Bank X Open Banking Hackathon</div>
    <h1>Build the next banking experience<br>in 48 hours.</h1>
    <p class="lead">Teams get sandbox access to our full API catalogue, mentoring from Bank X engineers, and a shot at the prize pool. Bring your idea, we bring the bank.</p>
    <div class="hero-cta">
      <obp-signup label="Register your team"></obp-signup>
      <div data-behaviour="countdown" data-until="${EVENT_DATE}" data-done="Hacking has started"></div>
    </div>
  </header>

  <div class="stats">
    <div><span class="stat-big"><obp-stat kind="endpoint-count"></obp-stat></span><span class="stat-label">API endpoints</span></div>
    <div><span class="stat-big"><obp-stat kind="product-count"></obp-stat></span><span class="stat-label">API products</span></div>
    <div><span class="stat-big"><obp-stat kind="bank-count"></obp-stat></span><span class="stat-label">Sandbox banks</span></div>
  </div>

  <section data-behaviour="reveal">
    <h2>Products open for the hackathon</h2>
    <obp-products limit="3" layout="cards"></obp-products>
  </section>

  <section data-behaviour="reveal">
    <h2>Start with these endpoints</h2>
    <obp-endpoints collection="${collectionId}" limit="5"></obp-endpoints>
  </section>

  <section>
    <h2>Your first call</h2>
    <div class="code-row">
      <pre id="hack-curl">curl https://apisandbox.bankx.example/obp/v6.0.0/banks</pre>
      <button data-behaviour="copy" data-target="#hack-curl">Copy</button>
    </div>
  </section>

  <section data-behaviour="tabs">
    <h2>Schedule</h2>
    <nav><button data-tab="fri">Friday</button><button data-tab="sat">Saturday</button><button data-tab="sun">Sunday</button></nav>
    <div data-panel="fri"><p>18:00 Doors open and team formation. 19:00 API walkthrough with Bank X engineers. 20:00 Hacking starts.</p></div>
    <div data-panel="sat"><p>All day hacking. 10:00 and 16:00 mentor rounds. 13:00 lunch on us.</p></div>
    <div data-panel="sun"><p>12:00 Code freeze. 14:00 Demos, 3 minutes per team. 16:00 Awards.</p></div>
  </section>

  <section>
    <h2>FAQ</h2>
    <details><summary>Do I need to be a customer?</summary><p>No. Anyone with a laptop can register. Sandbox data is synthetic.</p></details>
    <details><summary>Which banks are in the sandbox?</summary><obp-banks limit="6"></obp-banks></details>
  </section>

  <div class="footer-cta"><obp-signup label="Register your team" variant="secondary"></obp-signup></div>
</div>`;

export const PARTNER_PAGE = (collectionId: string) => `<style>
  .lp-partner { --obp-accent: #0f766e; --obp-accent-contrast: #fff; --obp-card-bg: #fff; --obp-card-fg: #1c1917; --obp-card-muted: #57534e; --obp-card-border: #e7e5e4; --obp-card-radius: 8px;
    background: #faf9f7; color: #1c1917; font-family: Georgia, "Times New Roman", serif; border-radius: 16px; overflow: hidden; }
  .lp-partner .top { display: grid; grid-template-columns: 1.2fr 1fr; gap: 32px; padding: 56px 48px; align-items: center; border-bottom: 1px solid #e7e5e4; }
  .lp-partner h1 { font-size: 44px; line-height: 1.1; margin: 0 0 16px; font-weight: 400; }
  .lp-partner h1 em { color: #0f766e; font-style: italic; }
  .lp-partner .lead { font-size: 18px; line-height: 1.6; color: #44403c; }
  .lp-partner .side { background: #fff; border: 1px solid #e7e5e4; padding: 24px; border-radius: 8px; font-family: ui-sans-serif, system-ui, sans-serif; }
  .lp-partner .side h3 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: #57534e; }
  .lp-partner .side p { margin: 0 0 16px; font-size: 14px; color: #44403c; }
  .lp-partner section { padding: 40px 48px; border-bottom: 1px solid #e7e5e4; }
  .lp-partner h2 { font-weight: 400; font-size: 28px; margin: 0 0 6px; }
  .lp-partner .sub { color: #57534e; margin: 0 0 20px; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px; }
  .lp-partner .obp-products--list .obp-product-card { flex-direction: row; align-items: baseline; gap: 20px; box-shadow: none; }
  .lp-partner .obp-products--list .obp-product-name { flex: 0 0 240px; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 16px; }
  .lp-partner .obp-products--list .obp-product-description { flex: 1; }
  .lp-partner .obp-products--list .obp-product-price { margin: 0; white-space: nowrap; font-family: ui-sans-serif, system-ui, sans-serif; }
  .lp-partner .obp-products--list .obp-product-category { display: none; }
  .lp-partner [data-behaviour="carousel"] [data-track] > .obp-endpoint { flex-basis: 320px; }
  .lp-partner [data-behaviour="carousel"] button { background: #fff; border: 1px solid #e7e5e4; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; }
  .lp-partner .obp-endpoint { font-family: ui-sans-serif, system-ui, sans-serif; }
  .lp-partner .tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; font-family: ui-sans-serif, system-ui, sans-serif; }
  .lp-partner .tier { background: #fff; border: 1px solid #e7e5e4; border-radius: 8px; padding: 20px; }
  .lp-partner .tier h3 { margin: 0 0 6px; font-size: 18px; }
  .lp-partner .tier p { color: #57534e; font-size: 14px; margin: 0 0 12px; line-height: 1.5; }
  .lp-partner .banks-row { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
  .lp-partner .banks-row .lbl { font-family: ui-sans-serif, system-ui, sans-serif; color: #57534e; font-size: 14px; }
  .lp-partner .obp-bank { border-radius: 8px; }
  .lp-partner .cta { padding: 40px 48px; display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap; }
  .lp-partner .cta p { margin: 0; font-size: 18px; }
  @media (max-width: 760px) { .lp-partner .top, .lp-partner .tiers { grid-template-columns: 1fr; } }
</style>
<div class="lp-partner obp-landing">
  <div class="top">
    <div>
      <h1>The Bank X <em>Partner Programme</em></h1>
      <p class="lead">Fintechs, ERP vendors and payment providers connect to Bank X through one catalogue of APIs, one subscription, one support desk. Launch in weeks, not quarters.</p>
    </div>
    <aside class="side">
      <h3>At a glance</h3>
      <p><strong><obp-stat kind="endpoint-count"></obp-stat></strong> endpoints across <strong><obp-stat kind="product-count"></obp-stat></strong> products.</p>
      <obp-signup label="Apply to join"></obp-signup>
    </aside>
  </div>

  <section>
    <h2>Products available to partners</h2>
    <p class="sub">Live from the catalogue. Pricing is per month, per application.</p>
    <obp-products limit="4" layout="list"></obp-products>
  </section>

  <section>
    <h2>Endpoints most partners start with</h2>
    <p class="sub">Swipe through, or open any of them in the API Explorer.</p>
    <div data-behaviour="carousel">
      <button data-prev aria-label="Previous">‹</button>
      <div data-track><obp-endpoints collection="${collectionId}" limit="8"></obp-endpoints></div>
      <button data-next aria-label="Next">›</button>
    </div>
  </section>

  <section>
    <h2>Three ways in</h2>
    <p class="sub">Choose the tier that matches your stage.</p>
    <div class="tiers">
      <div class="tier"><h3>Explore</h3><p>Sandbox access to every endpoint, community support, no cost.</p><obp-signup label="Start free" variant="secondary"></obp-signup></div>
      <div class="tier"><h3>Build</h3><p>Production keys for one product, email support with a two day response.</p><obp-signup label="Talk to us" variant="secondary"></obp-signup></div>
      <div class="tier"><h3>Scale</h3><p>Multiple products, named engineer, joint go-to-market.</p><obp-signup label="Talk to us" variant="secondary"></obp-signup></div>
    </div>
  </section>

  <section>
    <div class="banks-row"><span class="lbl">Available at</span><obp-banks limit="8"></obp-banks></div>
  </section>

  <div class="cta">
    <p>Ready to build with Bank X?</p>
    <obp-signup label="Apply to join"></obp-signup>
  </div>
</div>`;
