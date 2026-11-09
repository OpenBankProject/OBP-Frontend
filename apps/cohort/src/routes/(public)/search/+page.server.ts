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
import { search, SEARCH_KINDS, type SearchItem } from '$lib/search';
import { allAnnouncements } from '$lib/server/announcements';
import { APPLICATION, CALL, PARTICIPANT, PROGRAMME } from '$lib/server/entities/definitions';
import { idOf, listRecords, userToken } from '$lib/server/records';
import type { PageServerLoad } from './$types';

const s = (r: Record<string, unknown>, ...keys: string[]) => keys.map((k) => String(r[k] ?? '')).filter(Boolean).join(' ');

/**
 * Search what the visitor may read: public calls, programmes and announcements for everyone; their own applications
 * once logged in; every application and startup for staff holding the Get Roles (each read with the User's own token,
 * so OBP-API decides). Nothing is read until there is a query.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const kind = url.searchParams.get('kind') ?? '';
	const stage = url.searchParams.get('stage') ?? '';
	const sort = url.searchParams.get('sort') === 'date' ? 'date' : 'relevance';
	if (!q) return { q, kind, stage, sort, hits: [], stages: [] };

	const token = userToken(locals);
	const none = () => [] as Record<string, unknown>[];
	const [calls, programmes, announcements, mine, applications, participants] = await Promise.all([
		listRecords(CALL, 'public').catch(none),
		listRecords(PROGRAMME, 'public').catch(none),
		allAnnouncements(),
		token ? listRecords(APPLICATION, 'my', token).catch(none) : none(),
		token ? listRecords(APPLICATION, 'community', token).catch(none) : none(),
		token ? listRecords(PARTICIPANT, '', token).catch(none) : none()
	]);
	const staff = applications.length > 0 || participants.length > 0;
	const programmeName = new Map(programmes.map((p) => [idOf(PROGRAMME, p), String(p.name ?? '')]));
	const mineIds = new Set(mine.map((a) => idOf(APPLICATION, a)));

	const items: SearchItem[] = [
		...calls
			.filter((c) => c.status !== 'draft')
			.map((c) => ({ kind: 'call' as const, id: idOf(CALL, c), title: String(c.title ?? ''), text: `${s(c, 'description')} ${programmeName.get(String(c.programme_id)) ?? ''}`, href: `/calls/${idOf(CALL, c)}`, date: String(c.opens_at ?? '') })),
		...programmes
			.filter((p) => p.status !== 'draft')
			.map((p) => ({ kind: 'programme' as const, id: idOf(PROGRAMME, p), title: String(p.name ?? ''), text: s(p, 'description'), href: staff ? `/staff/programmes/${idOf(PROGRAMME, p)}` : '/', date: String(p.starts_on ?? '') })),
		...announcements.map((a) => ({ kind: 'announcement' as const, id: a.id, title: `${a.title} ${a.title_ar}`.trim(), text: `${a.body} ${a.body_ar}`, href: token ? '/updates' : '/', date: a.published_at })),
		...[...mine, ...applications.filter((a) => !mineIds.has(idOf(APPLICATION, a)))].map((a) => {
			const id = idOf(APPLICATION, a);
			return {
				kind: 'application' as const,
				id,
				title: String(a.startup_name ?? '') || id,
				text: s(a, 'sector', 'problem_statement', 'solution', 'market_understanding', 'website'),
				href: mineIds.has(id) ? `/applications/${id}` : `/staff/applications/${id}`,
				date: String(a.submitted_at ?? ''),
				stage: String(a.status ?? '')
			};
		}),
		...participants.map((p) => ({
			kind: 'startup' as const,
			id: idOf(PARTICIPANT, p),
			title: String(p.startup_name ?? ''),
			text: `${programmeName.get(String(p.programme_id)) ?? ''} ${s(p, 'risk_note')}`,
			href: '/staff/participants',
			date: String(p.joined_at ?? ''),
			stage: String(p.stage ?? '')
		}))
	];
	const hits = search(items, q, { kind: (SEARCH_KINDS as readonly string[]).includes(kind) ? kind : undefined, stage: stage || undefined, sort });
	const stages = [...new Set(items.map((i) => i.stage).filter((x): x is string => !!x))].sort();
	return { q, kind, stage, sort, hits: hits.slice(0, 100), stages };
};
