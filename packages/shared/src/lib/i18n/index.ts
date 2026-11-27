/*
 * Copyright (C) 2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details: <https://www.gnu.org/licenses/>.
 */
/**
 * Translations for the OBP-Frontend apps. The messages are in packages/shared/messages/<locale>.json; `npm run prepare` (or `npm run i18n`) in packages/shared compiles them into src/lib/paraglide. Use `m.<key>()` for a message, in the language of the page.
 */
import { getLocale, locales, setLocale, type Locale } from '$shared/paraglide/runtime.js';

export { m } from '$shared/paraglide/messages.js';
export { getLocale, locales, setLocale, type Locale };

/** Each language's name in that language, for the language switch. */
export const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', ar: 'العربية' };

/** Languages written right to left. */
const RIGHT_TO_LEFT: readonly Locale[] = ['ar'];

/** The text direction for a language, for the page's dir attribute. */
export function textDirection(locale: Locale): 'ltr' | 'rtl' {
	return RIGHT_TO_LEFT.includes(locale) ? 'rtl' : 'ltr';
}

/** Which digits Arabic pages show numbers and dates in: Western (123) or Arabic-Indic (١٢٣). Set per installation with ARABIC_DIGITS. */
export type ArabicDigits = 'western' | 'arabic-indic';

/** ARABIC_DIGITS as written in the environment: "arabic-indic", or Western for anything else, including unset. */
export function parseArabicDigits(value: string | undefined): ArabicDigits {
	return value?.trim().toLowerCase() === 'arabic-indic' ? 'arabic-indic' : 'western';
}

// The installation's setting: on the server set by $shared/server/i18n from ARABIC_DIGITS; in the browser read from <html data-arabic-digits>
let serverArabicDigits: ArabicDigits = 'western';

/** Called once by $shared/server/i18n with the installation's setting. */
export function setServerArabicDigits(digits: ArabicDigits): void {
	serverArabicDigits = digits;
}

/** The installation's setting, on the server or in the browser. */
export function arabicDigits(): ArabicDigits {
	return typeof document === 'undefined' ? serverArabicDigits : parseArabicDigits(document.documentElement.dataset.arabicDigits);
}

/** The locale to format numbers and dates with: the page's language, with the digits for Arabic (e.g. ar-u-nu-latn), and UK English for English. */
export function formattingLocale(locale: Locale = getLocale(), digits: ArabicDigits = arabicDigits()): string {
	return locale === 'ar' ? `ar-u-nu-${digits === 'arabic-indic' ? 'arab' : 'latn'}` : 'en-GB';
}

/** A number in the page's language and digits. Codes such as account numbers, versions and IDs are not numbers: show those as they are. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
	return new Intl.NumberFormat(formattingLocale(), options).format(value);
}

/** A date (and time, with the options) in the page's language and digits. Times always use the 24-hour clock. */
export function formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat(formattingLocale(), { hourCycle: 'h23', ...options }).format(value);
}

/** The inputs of a counting message: `count` picks the plural form, `shown` is the number as the page shows it. For example `m.conformator_step_run_count(counted(runs))`. */
export function counted(count: number): { count: number; shown: string } {
	return { count, shown: formatNumber(count) };
}

/** A list of names joined in the page's language, e.g. "Bank A, Bank B and Bank C". */
export function formatList(items: string[]): string {
	return new Intl.ListFormat(formattingLocale(), { style: 'long', type: 'conjunction' }).format(items);
}

/** A day stored as YYYY-MM-DD (or a longer ISO date-time), as the page's language writes it, e.g. 24 November 2026. Anything else is shown as it is. */
export function formatDay(isoDate: string): string {
	const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
	if (!day) return isoDate;
	return formatDate(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
