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
import type { Locale } from '$lib/i18n';
import { inLocale } from '$lib/forms';

/** An announcement from the programme office: public, for everyone or about one programme. */
export interface Announcement {
	id: string;
	title: string;
	title_ar: string;
	body: string;
	body_ar: string;
	programme_id: string;
	published_at: string;
	published_by_username: string;
}

export function announcementOf(id: string, r: Record<string, unknown>): Announcement {
	const s = (key: string) => String(r[key] ?? '');
	return {
		id,
		title: s('title'),
		title_ar: s('title_ar'),
		body: s('body'),
		body_ar: s('body_ar'),
		programme_id: s('programme_id'),
		published_at: s('published_at'),
		published_by_username: s('published_by_username')
	};
}

/** Newest first. */
export const newestFirst = (a: Announcement, b: Announcement) => b.published_at.localeCompare(a.published_at);

/** The announcements for these programmes' startups: those for everyone and those about one of the programmes. */
export function announcementsFor(all: Announcement[], programmeIds: string[] | null): Announcement[] {
	return all.filter((a) => !a.programme_id || (programmeIds ?? []).includes(a.programme_id)).sort(newestFirst);
}

/** The announcement in the reader's language, falling back to the other when it has none. */
export function inReaderLocale(a: Announcement, locale: Locale) {
	return { title: inLocale(locale, a.title, a.title_ar), body: inLocale(locale, a.body, a.body_ar) };
}
