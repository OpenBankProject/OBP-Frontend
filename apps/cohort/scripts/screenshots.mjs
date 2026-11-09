#!/usr/bin/env node
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
 * Screenshots of Cohort's pages, in each language, as the visitor, a startup and staff, with an index (index.md, and
 * index.html to scroll through) mapping each screenshot to what it shows. The pages, who sees them and what each
 * evidences come from a JSON config:
 *
 *   {
 *     "requirements": { "R1": "What the page evidences", ... },
 *     "pages": [
 *       { "id": "open-calls", "as": "public" | "startup" | "staff", "path": "/",
 *         "from": "/staff", "link": "^/staff/calls/[^/]+$",      (instead of path: follow the first matching link)
 *         "suffix": "/evaluation",                                (added to the link found)
 *         "fullPage": true, "waitFor": "[data-testid=...]", "requirements": ["R1"] }
 *     ]
 *   }
 *
 *   node apps/cohort/scripts/screenshots.mjs <config.json> <credentials.env> <output folder> [--public-only] [--locales en,ar] [--only id,id]
 *
 * The credentials file holds COHORT_URL (default http://localhost:5183), STAFF_USERNAME, STAFF_PASSWORD,
 * STARTUP_USERNAME and STARTUP_PASSWORD. The users log in through Cohort's own /login, as a person would. Light mode,
 * 1440x900. Uses Playwright from the monorepo and a Chromium given by CHROMIUM_PATH (default /snap/bin/chromium).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !['--locales', '--only'].includes(args[i - 1]));
const [configPath, envPath, outDir] = positional;
if (!configPath || !envPath || !outDir) {
	console.error('Usage: node apps/cohort/scripts/screenshots.mjs <config.json> <credentials.env> <output folder> [--public-only] [--locales en,ar] [--only id,id]');
	process.exit(2);
}

function readEnv(path) {
	const env = {};
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
		if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
	}
	return env;
}

const env = readEnv(envPath);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const cohortUrl = (env.COHORT_URL || 'http://localhost:5183').replace(/\/+$/, '');
const locales = (option('--locales') ?? 'en,ar').split(',').filter(Boolean);
const only = option('--only')?.split(',');
const publicOnly = flag('--public-only');
const out = resolve(outDir);
mkdirSync(out, { recursive: true });

const users = {
	staff: { username: env.STAFF_USERNAME, password: env.STAFF_PASSWORD },
	startup: { username: env.STARTUP_USERNAME, password: env.STARTUP_PASSWORD }
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/snap/bin/chromium', headless: true });

/** A logged-in browser state per user, made once: Cohort's /login, then the identity provider's form. */
const sessions = {};
async function sessionOf(who) {
	if (who === 'public') return undefined;
	if (sessions[who]) return sessions[who];
	const { username, password } = users[who];
	if (!username || !password) throw new Error(`${who.toUpperCase()}_USERNAME and _PASSWORD are not set`);
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();
	await page.goto(`${cohortUrl}/login`);
	await page.locator('input[name="username"], #username').first().fill(username);
	await page.locator('input[name="password"], #password').first().fill(password);
	await Promise.all([
		page.waitForURL((url) => url.href.startsWith(cohortUrl) && !url.pathname.startsWith('/login'), { timeout: 30_000 }),
		page.locator('button[type="submit"], input[type="submit"]').first().click()
	]);
	sessions[who] = await context.storageState();
	await context.close();
	return sessions[who];
}

/** A page for this user in this language, in light mode. */
async function pageFor(who, locale) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: await sessionOf(who), locale: locale === 'ar' ? 'ar' : 'en-GB' });
	await context.addCookies([{ name: 'cohort_locale', value: locale, url: cohortUrl }]);
	await context.addInitScript(() => {
		try {
			localStorage.setItem('mode', 'light');
		} catch {
			// The page still renders, in its default mode.
		}
	});
	return { context, page: await context.newPage() };
}

/**
 * Where a page entry points: its path, or the first link on `from` whose path matches `link` (and whose text contains
 * `text`, when given), plus `suffix`.
 */
async function targetOf(page, entry) {
	if (entry.path) return entry.path;
	await page.goto(cohortUrl + entry.from, { waitUntil: 'load' });
	const pattern = new RegExp(entry.link);
	const links = await page.$$eval('a[href]', (as) => as.map((a) => ({ href: a.getAttribute('href') ?? '', text: a.textContent ?? '' })));
	const found = links
		.filter((l) => !entry.text || l.text.includes(entry.text))
		.map((l) => l.href.split(/[?#]/)[0])
		.filter((h) => pattern.test(h))[entry.nth ?? 0];
	if (!found) throw new Error(`no link matching ${entry.link} on ${entry.from}`);
	return found + (entry.suffix ?? '');
}

const shots = [];
const failures = [];
for (const entry of config.pages) {
	if (only && !only.includes(entry.id)) continue;
	if (publicOnly && entry.as !== 'public') continue;
	for (const locale of locales) {
		const file = `${entry.as}-${entry.id}-${locale}.png`;
		let context;
		try {
			const opened = await pageFor(entry.as, locale);
			context = opened.context;
			const { page } = opened;
			const target = await targetOf(page, entry);
			await page.goto(cohortUrl + target, { waitUntil: 'load' });
			if (entry.waitFor) await page.locator(entry.waitFor).first().waitFor({ timeout: 15_000 });
			// Images such as the logo, fonts, and what loads after the page.
			await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15_000 }).catch(() => {});
			await page.waitForTimeout(entry.settleMs ?? 1200);
			await page.screenshot({ path: join(out, file), fullPage: entry.fullPage ?? false });
			shots.push({ entry, locale, file, target });
			console.log(`ok ${file}`);
		} catch (err) {
			failures.push({ entry, locale, error: err instanceof Error ? err.message.split('\n')[0] : String(err) });
			console.log(`failed ${file}: ${failures.at(-1).error}`);
		} finally {
			await context?.close();
		}
	}
}
await browser.close();

// The index covers every screenshot in the folder, not only this run's: a run with --only or --locales keeps the rest.
// shots.json remembers the address each was taken at.
const takenPath = join(out, 'shots.json');
const taken = existsSync(takenPath) ? JSON.parse(readFileSync(takenPath, 'utf8')) : {};
for (const s of shots) taken[s.file] = { target: s.target, at: new Date().toISOString() };
writeFileSync(takenPath, JSON.stringify(taken, null, 2) + '\n');
const thisRun = shots.length;
shots.length = 0;
for (const entry of config.pages)
	for (const locale of ['en', 'ar']) {
		const file = `${entry.as}-${entry.id}-${locale}.png`;
		if (taken[file] && existsSync(join(out, file))) shots.push({ entry, locale, file, target: taken[file].target });
	}

// The index: each screenshot with what it evidences, then each requirement with its screenshots.
const requirements = config.requirements ?? {};
const lines = [`# Cohort screenshots`, '', `Last run ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from ${cohortUrl}; shots.json has when each screenshot was taken.`, '', '| Screenshot | Page | Seen as | Language | Evidences |', '|---|---|---|---|---|'];
for (const s of shots) {
	const evidences = (s.entry.requirements ?? []).map((r) => `${r}: ${requirements[r] ?? ''}`).join('<br>');
	lines.push(`| [${s.file}](${s.file}) | \`${s.target}\` | ${s.entry.as} | ${s.locale} | ${evidences} |`);
}
lines.push('', '## By requirement', '');
for (const [key, text] of Object.entries(requirements)) {
	const files = shots.filter((s) => (s.entry.requirements ?? []).includes(key)).map((s) => `[${s.file}](${s.file})`);
	lines.push(`- **${key}** ${text}: ${files.length ? files.join(', ') : '_no screenshot_'}`);
}
if (failures.length) {
	lines.push('', '## Not taken', '');
	for (const f of failures) lines.push(`- ${f.entry.as}-${f.entry.id}-${f.locale}: ${f.error}`);
}
writeFileSync(join(out, 'index.md'), lines.join('\n') + '\n');

// The same as a page to scroll through: each page's screenshots side by side, English then Arabic.
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const byPage = config.pages.map((entry) => ({ entry, shots: shots.filter((s) => s.entry === entry) })).filter((p) => p.shots.length);
const anchor = (entry) => `${entry.as}-${entry.id}`;
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cohort screenshots</title>
<style>
:root { --bg: #fff; --fg: #1a1a1a; --muted: #5f6368; --line: #dadce0; --card: #f6f7f8; }
@media (prefers-color-scheme: dark) { :root { --bg: #121212; --fg: #e8eaed; --muted: #9aa0a6; --line: #3c4043; --card: #1e1f20; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 1600px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { margin: 0 0 4px; font-size: 26px; }
h2 { margin: 0; font-size: 18px; }
p, li { color: var(--muted); }
a { color: inherit; }
nav ul { columns: 2 320px; padding-left: 18px; }
section { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--line); }
.meta { margin: 4px 0 12px; font-size: 14px; }
.shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 480px), 1fr)); gap: 16px; }
figure { margin: 0; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 8px; }
figure img { display: block; width: 100%; height: auto; border-radius: 4px; }
figcaption { margin-top: 6px; font-size: 13px; color: var(--muted); }
</style>
</head>
<body>
<main>
<h1>Cohort screenshots</h1>
<p>${shots.length} screenshots of ${byPage.length} pages, from ${esc(cohortUrl)}. Last run ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Click a screenshot to open it full size.</p>
<h2>By requirement</h2>
<nav><ul>
${Object.entries(requirements).map(([key, text]) => {
	const pages = byPage.filter((p) => (p.entry.requirements ?? []).includes(key));
	return `<li><strong>${esc(key)}</strong> ${esc(text)}: ${pages.length ? pages.map((p) => `<a href="#${anchor(p.entry)}">${esc(p.entry.id)}</a>`).join(', ') : 'no screenshot'}</li>`;
}).join('\n')}
</ul></nav>
${byPage.map(({ entry, shots: own }) => `<section id="${anchor(entry)}">
<h2>${esc(entry.id)}</h2>
<p class="meta">Seen as ${esc(entry.as)} · <code>${esc(own[0].target)}</code> · ${(entry.requirements ?? []).map((r) => `${esc(r)}: ${esc(requirements[r] ?? '')}`).join('; ')}</p>
<div class="shots">
${own.map((s) => `<figure><a href="${esc(s.file)}"><img src="${esc(s.file)}" alt="${esc(entry.id)}, ${s.locale === 'ar' ? 'Arabic' : 'English'}" loading="lazy"></a><figcaption>${s.locale === 'ar' ? 'Arabic' : 'English'} · ${esc(s.file)}</figcaption></figure>`).join('\n')}
</div>
</section>`).join('\n')}
</main>
</body>
</html>
`;
writeFileSync(join(out, 'index.html'), html);
console.log(`\n${thisRun} screenshots, ${failures.length} failed; index at ${join(out, 'index.md')} and index.html (${shots.length} in all)`);
if (failures.length) process.exitCode = 1;
