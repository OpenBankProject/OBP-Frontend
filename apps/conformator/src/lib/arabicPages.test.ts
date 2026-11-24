/*
 * Copyright (C) 2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { paraglideMiddleware } from '$shared/paraglide/server.js';
import HomePage from '../routes/(public)/+page.svelte';
import ReportsPage from '../routes/(public)/reports/+page.svelte';

/** Draw a page as the server does for a visitor who chose this language with the language switch. */
async function draw(locale: 'en' | 'ar', page: typeof HomePage | typeof ReportsPage, props: Record<string, unknown>): Promise<string> {
	const request = new Request('http://localhost/', { headers: { cookie: `PARAGLIDE_LOCALE=${locale}` } });
	const html = await paraglideMiddleware(request, () => render(page as never, { props }).body);
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
});
