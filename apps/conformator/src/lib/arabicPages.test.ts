/*
 * Copyright (C) 2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { paraglideMiddleware } from '$shared/paraglide/server.js';
import HomePage from '../routes/(public)/+page.svelte';
import ReportsPage from '../routes/(public)/reports/+page.svelte';
import LoginPage from '../routes/(public)/login/+page.svelte';

/** Draw a page as the server does for a visitor who chose this language with the language switch. */
async function draw(locale: 'en' | 'ar', page: unknown, props: Record<string, unknown>): Promise<string> {
	const request = new Request('http://localhost/', { headers: { cookie: `PARAGLIDE_LOCALE=${locale}` } });
	let html = '';
	await paraglideMiddleware(request, () => {
		html = render(page as never, { props: props as never }).body;
		return new Response(html);
	});
	// Without Svelte's hydration markers, which sit inside the tags
	return html.replace(/<!--.*?-->/g, '');
}

const homeData = { data: { content: { suites: 1, reports: 1 }, isStaff: false } };

describe('the public pages in Arabic', () => {
	it('draws the home page in Arabic, keeping the bold words as tags', async () => {
		const html = await draw('ar', HomePage, homeData);
		expect(html).toContain('تهيئة Conformator للاستخدام');
		expect(html).toContain('عرض دليل الاختبارات');
		expect(html).toContain('<strong>المشاركون</strong>');
		expect(html).not.toContain('{#strong}');
	});

	it('draws the home page in English for an English visitor', async () => {
		const html = await draw('en', HomePage, homeData);
		expect(html).toContain('Prepare Conformator for Use');
		expect(html).toContain('<strong>Participants</strong>: banks');
	});

	it('draws the report search in Arabic', async () => {
		const html = await draw('ar', ReportsPage, { data: {}, form: null });
		expect(html).toContain('التحقق من تقرير مطابقة');
		expect(html).toContain('تحقّق');
	});

	it('draws the login page and its error in Arabic', async () => {
		const html = await draw('ar', LoginPage, { data: { providers: ['obp'], loginError: 'login_failed' } });
		expect(html).toContain('تسجيل الدخول عبر obp');
		expect(html).toContain('تعذّر تسجيل الدخول');
		const english = await draw('en', LoginPage, { data: { providers: ['obp'], loginError: 'login_failed' } });
		expect(english).toContain('Log in with obp');
		expect(english).toContain('Logging in failed. Please try again.');
	});
});
