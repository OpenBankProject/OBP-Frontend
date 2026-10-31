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
 * UI text for every supported locale. All UI text goes through `t`; no literal strings in pages.
 * English is the reference: a key missing from another locale falls back to English.
 */
import { en, type MessageKey } from './en';
import { ar } from './ar';

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'cohort_locale';

const RTL_LOCALES: ReadonlySet<Locale> = new Set(['ar']);
const MESSAGES: Record<Locale, Partial<Record<MessageKey, string>>> = { en, ar };

export function isLocale(value: string | null | undefined): value is Locale {
	return !!value && (LOCALES as readonly string[]).includes(value);
}

export function dir(locale: Locale): 'rtl' | 'ltr' {
	return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export function t(locale: Locale, key: MessageKey): string {
	return MESSAGES[locale][key] ?? en[key];
}

/** The cookie wins, then the first supported language in Accept-Language, then the default. */
export function resolveLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
	if (isLocale(cookie)) return cookie;
	for (const part of (acceptLanguage ?? '').split(',')) {
		const primary = part.split(';')[0].trim().toLowerCase().split('-')[0];
		if (isLocale(primary)) return primary;
	}
	return DEFAULT_LOCALE;
}

export type { MessageKey };
