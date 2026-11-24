/*
 * Copyright (C) 2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details: <https://www.gnu.org/licenses/>.
 */
import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$shared/paraglide/server.js';
import { arabicDigits, parseArabicDigits, setServerArabicDigits, textDirection } from '$shared/i18n';

// ARABIC_DIGITS: "western" (the default) or "arabic-indic", for numbers and dates on Arabic pages; anything else is Western, with a warning
const configuredDigits = process.env.ARABIC_DIGITS;
if (configuredDigits && !['western', 'arabic-indic'].includes(configuredDigits.trim().toLowerCase())) {
	console.warn(`ARABIC_DIGITS="${configuredDigits}" is not "western" or "arabic-indic": using Western digits.`);
}
setServerArabicDigits(parseArabicDigits(configuredDigits));

/**
 * Works out each request's language (the language switch's cookie, else the browser's language, else English), so `m.<key>()` gives that language while the page is drawn, and fills in %paraglide.lang%, %paraglide.dir% and %arabic.digits% in app.html. Put it early in the app's handle sequence.
 */
export const i18nHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html.replace('%paraglide.lang%', locale).replace('%paraglide.dir%', textDirection(locale)).replace('%arabic.digits%', arabicDigits())
		});
	});
