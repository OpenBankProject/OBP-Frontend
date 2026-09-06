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
/** Starter sources for App Studio, one per mode. Kept out of the .svelte file: see the note there. */

export const STARTER_APP_TITLE = "My OBP App";
export const STARTER_APP_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>My OBP App</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #f4f5f7; color: #111; }
  header { padding: 20px 16px 12px; background: #1d4ed8; color: #fff; }
  h1 { margin: 0; font-size: 20px; }
  main { padding: 16px; }
  .card { background: #fff; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
  .muted { color: #666; font-size: 13px; }
</style>
</head>
<body>
<header><h1>Banks</h1><div class="muted" style="color:#dbeafe">Loaded from OBP</div></header>
<main id="app"><p class="muted">Loading…</p></main>
<script>
  (async () => {
    const app = document.getElementById('app');
    try {
      const data = await obp.get('/obp/v6.0.0/banks');
      app.innerHTML = data.banks.map(b =>
        '<div class="card"><strong>' + b.full_name + '</strong><div class="muted">' + b.bank_id + '</div></div>'
      ).join('') || '<p class="muted">No banks.</p>';
    } catch (e) {
      app.innerHTML = '<p style="color:#b91c1c">' + e.message + '</p>';
    }
  })();
</script>
</body>
</html>
`;

export const STARTER_LANDING_TITLE = "Developer launch";
export const STARTER_LANDING_HTML = `<style>
.lp { --obp-accent: #1d4ed8; font-family: system-ui, sans-serif; color: #111; background: #fff; }
.lp .hero { padding: 48px 32px 32px; background: linear-gradient(135deg, #1e3a8a, #1d4ed8); color: #fff; }
.lp h1 { margin: 0 0 8px; font-size: 36px; line-height: 1.1; }
.lp .lead { max-width: 60ch; opacity: .9; font-size: 17px; }
.lp section { padding: 24px 32px; }
.lp h2 { font-size: 22px; margin: 0 0 12px; }
</style>
<div class="lp obp-landing">
<header class="hero">
  <h1>Build on our APIs</h1>
  <p class="lead">Everything you need to go from idea to a working integration: <strong><obp-stat kind="endpoint-count"></obp-stat></strong> endpoints, sandbox data and a free tier.</p>
  <obp-signup label="Get your API key"></obp-signup>
</header>
<section>
  <h2>Popular products</h2>
  <obp-products limit="3"></obp-products>
</section>
<section>
  <h2>Banks in the sandbox</h2>
  <obp-banks limit="6"></obp-banks>
</section>
</div>
`;

