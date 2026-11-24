/*
 * Copyright (C) 2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { afterEach, describe, expect, it } from 'vitest';
import { arabicDigits, counted, formatDay, formatList, formattingLocale, parseArabicDigits, setServerArabicDigits } from '$shared/i18n';

describe('ARABIC_DIGITS', () => {
	afterEach(() => setServerArabicDigits('western'));

	it('is Western unless set to arabic-indic', () => {
		expect([undefined, '', 'western', 'Arabic-Indic', 'arab'].map(parseArabicDigits)).toEqual([
			'western',
			'western',
			'western',
			'arabic-indic',
			'western'
		]);
	});

	it('defaults to Western digits on the server', () => {
		expect(arabicDigits()).toBe('western');
	});

	it('formats Arabic numbers and dates with the chosen digits, and English as English', () => {
		const date = new Date(Date.UTC(2026, 10, 24));
		const day = (locale: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' }).format(date);
		expect(new Intl.NumberFormat(formattingLocale('ar', 'western')).format(1234)).toBe('1,234');
		expect(new Intl.NumberFormat(formattingLocale('ar', 'arabic-indic')).format(1234)).toBe('١٬٢٣٤');
		expect(day(formattingLocale('ar', 'arabic-indic'))).toBe('٢٤');
		expect(day(formattingLocale('ar', 'western'))).toBe('24');
		expect(formattingLocale('en', 'arabic-indic')).toBe('en-GB');
	});

	it('writes days, lists and counts the UK English way outside a request', () => {
		expect(formatDay('2026-11-24')).toBe('24 November 2026');
		expect(formatDay('2026-11-24T10:00:00Z')).toBe('24 November 2026');
		expect(formatDay('not a date')).toBe('not a date');
		expect(formatList(['Bank A', 'Bank B', 'Bank C'])).toBe('Bank A, Bank B and Bank C');
		expect(counted(1200)).toEqual({ count: 1200, shown: '1,200' });
	});
});
