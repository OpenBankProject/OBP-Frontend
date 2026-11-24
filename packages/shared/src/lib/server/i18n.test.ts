/*
 * Copyright (C) 2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it } from 'vitest';
import type { RequestEvent, ResolveOptions } from '@sveltejs/kit';
import { i18nHandle } from './i18n';
import { m, textDirection } from '$shared/i18n';

/** Run the handle for a request with these headers; returns the page it draws from a template that uses the placeholders. */
async function drawPage(headers: Record<string, string>): Promise<string> {
	// A minimal request event: the handle only reads and replaces the request
	const event = { request: new Request('http://localhost/', { headers }) } as unknown as RequestEvent;
	// The app: draws a template and passes it through the handle's transformPageChunk, as SvelteKit does
	const resolve = async (_event: RequestEvent, options?: ResolveOptions) => {
		const html = `<html lang="%paraglide.lang%" dir="%paraglide.dir%">${m.login()}</html>`;
		const transformed = await options!.transformPageChunk!({ html, done: true });
		return new Response(transformed);
	};
	const response = await i18nHandle({ event, resolve });
	return response.text();
}

describe('i18nHandle', () => {
	it('draws English, left to right, by default', async () => {
		expect(await drawPage({})).toBe('<html lang="en" dir="ltr">Login</html>');
	});

	it('draws Arabic, right to left, for a browser that prefers Arabic', async () => {
		expect(await drawPage({ 'accept-language': 'ar-OM,ar;q=0.9,en;q=0.5' })).toBe('<html lang="ar" dir="rtl">تسجيل الدخول</html>');
	});

	it('follows the language switch cookie over the browser language', async () => {
		expect(await drawPage({ cookie: 'PARAGLIDE_LOCALE=en', 'accept-language': 'ar' })).toBe('<html lang="en" dir="ltr">Login</html>');
	});
});

describe('textDirection', () => {
	it('is right to left for Arabic only', () => {
		expect([textDirection('ar'), textDirection('en')]).toEqual(['rtl', 'ltr']);
	});
});
