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
import { env as publicEnv } from '$env/dynamic/public';
import { expandLiveTags, type LandingCall, type LandingFetchers, type LandingProgramme, type SitePage } from '@obp/shared/landing';
import { buildLandingFetchers, sanitizePageHtml } from '@obp/shared/server/landing';
import { isCallOpen } from '$lib/applications';
import { requestApplicationAccessToken } from './applicationToken';
import { CALL, PROGRAMME } from './entities/definitions';
import { obpRequests } from './obp';
import { idOf, listRecords } from './records';

/**
 * A page published to Cohort with App Studio, ready to render: a page is sanitised and its live-data tags filled
 * with Cohort's application token (visitors may be anonymous); an App is handed over as source, to run in a
 * sandboxed frame. On Cohort, pages also have the programme tags: <obp-calls> and <obp-programmes>.
 */

export interface PageView {
	slug: string;
	title: string;
	kind: 'page' | 'app';
	summary: string;
	isLoggedIn: boolean;
	source: string;
	html: string;
}

/** The open calls, newest closing date last; read publicly, as visitors see them. */
async function openCalls(programme: string | undefined, limit: number): Promise<LandingCall[]> {
	const [calls, programmes] = await Promise.all([listRecords(CALL, 'public'), listRecords(PROGRAMME, 'public')]);
	const names = new Map(programmes.map((p) => [idOf(PROGRAMME, p), String(p.name ?? '')]));
	return calls
		.filter((c) => isCallOpen(c))
		.map((c) => ({
			title: String(c.title ?? ''),
			description: String(c.description ?? ''),
			programme: names.get(String(c.programme_id)) ?? '',
			opens_at: String(c.opens_at ?? ''),
			closes_at: String(c.closes_at ?? ''),
			href: `/calls/${idOf(CALL, c)}`
		}))
		.filter((c) => !programme || c.programme.toLowerCase() === programme.toLowerCase())
		.sort((a, b) => (a.closes_at || '9999').localeCompare(b.closes_at || '9999'))
		.slice(0, limit);
}

/** The programmes that are not drafts, earliest start first. */
async function programmes(limit: number): Promise<LandingProgramme[]> {
	return (await listRecords(PROGRAMME, 'public'))
		.filter((p) => p.status !== 'draft')
		.map((p) => ({
			name: String(p.name ?? ''),
			description: String(p.description ?? ''),
			starts_on: String(p.starts_on ?? ''),
			ends_on: String(p.ends_on ?? '')
		}))
		.sort((a, b) => (a.starts_on || '9999').localeCompare(b.starts_on || '9999'))
		.slice(0, limit);
}

async function cohortFetchers(): Promise<LandingFetchers> {
	const app = await requestApplicationAccessToken();
	return {
		...buildLandingFetchers((path, t) => obpRequests.get(path, t), app.token ?? undefined, {
			portalUrl: '',
			explorerUrl: '',
			obpBaseUrl: publicEnv.PUBLIC_OBP_BASE_URL ?? ''
		}),
		calls: ({ programme, limit }) => openCalls(programme, limit),
		programmes: ({ limit }) => programmes(limit)
	};
}

export async function pageView(page: SitePage, isLoggedIn: boolean): Promise<PageView> {
	const base = { slug: page.slug, title: page.title, kind: page.kind, summary: page.summary, isLoggedIn };
	if (page.kind === 'app') return { ...base, source: page.source, html: '' };
	const html = await expandLiveTags(sanitizePageHtml(page.source), await cohortFetchers(), { onError: 'hide' });
	return { ...base, source: '', html };
}
