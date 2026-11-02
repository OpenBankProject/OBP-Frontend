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
import type { MessageKey } from '$lib/i18n';

/**
 * The site map: every page of Cohort, from the route files, grouped by who uses it and nested by address. Each page
 * needs a title and a line about it here; a test fails for a page without one, so the map stays complete.
 */

export type Audience = 'everyone' | 'applicants' | 'reviewers' | 'staff';
export const AUDIENCES: Audience[] = ['everyone', 'applicants', 'reviewers', 'staff'];

export const PAGES: Record<string, { title: MessageKey; about: MessageKey }> = {
	'/': { title: 'map_calls', about: 'map_calls_about' },
	'/calls/[id]': { title: 'map_call', about: 'map_call_about' },
	'/login': { title: 'map_login', about: 'map_login_about' },
	'/sitemap': { title: 'map_sitemap', about: 'map_sitemap_about' },
	'/dashboard': { title: 'map_dashboard', about: 'map_dashboard_about' },
	'/applications': { title: 'map_applications', about: 'map_applications_about' },
	'/applications/[id]': { title: 'map_application', about: 'map_application_about' },
	'/calls/[id]/details': { title: 'map_details', about: 'map_details_about' },
	'/programme': { title: 'map_programme_mine', about: 'map_programme_mine_about' },
	'/programme/certificate/[id]': { title: 'map_certificate', about: 'map_certificate_about' },
	'/programme/surveys/[id]': { title: 'map_survey', about: 'map_survey_about' },
	'/conversations': { title: 'map_my_conversations', about: 'map_my_conversations_about' },
	'/conversations/[id]': { title: 'map_my_conversation', about: 'map_my_conversation_about' },
	'/review': { title: 'map_review', about: 'map_review_about' },
	'/review/[id]': { title: 'map_review_one', about: 'map_review_one_about' },
	'/staff': { title: 'map_staff', about: 'map_staff_about' },
	'/staff/access': { title: 'map_access', about: 'map_access_about' },
	'/staff/dashboard': { title: 'map_dashboard_staff', about: 'map_dashboard_staff_about' },
	'/staff/applications': { title: 'map_staff_applications', about: 'map_staff_applications_about' },
	'/staff/applications/[id]': { title: 'map_staff_application', about: 'map_staff_application_about' },
	'/staff/programmes/[id]': { title: 'map_programme', about: 'map_programme_about' },
	'/staff/programmes/[id]/edit': { title: 'map_programme_edit', about: 'map_programme_edit_about' },
	'/staff/programmes/[id]/milestones': { title: 'map_milestones', about: 'map_milestones_about' },
	'/staff/programmes/[id]/sessions': { title: 'map_sessions', about: 'map_sessions_about' },
	'/staff/calls/[id]': { title: 'map_staff_call', about: 'map_staff_call_about' },
	'/staff/calls/[id]/edit': { title: 'map_call_edit', about: 'map_call_edit_about' },
	'/staff/calls/[id]/evaluation': { title: 'map_evaluation', about: 'map_evaluation_about' },
	'/staff/forms': { title: 'map_forms', about: 'map_forms_about' },
	'/staff/forms/[id]': { title: 'map_form', about: 'map_form_about' },
	'/staff/reviewers': { title: 'map_reviewers', about: 'map_reviewers_about' },
	'/staff/reminders': { title: 'map_reminders', about: 'map_reminders_about' },
	'/staff/participants': { title: 'map_participants', about: 'map_participants_about' },
	'/staff/conversations': { title: 'map_conversations', about: 'map_conversations_about' },
	'/staff/conversations/[id]': { title: 'map_conversation', about: 'map_conversation_about' },
	'/staff/example-data': { title: 'map_example_data', about: 'map_example_data_about' },
	'/staff/setup': { title: 'map_setup', about: 'map_setup_about' }
};

export interface MapPage {
	route: string;
	/** Reached only after logging in. */
	login: boolean;
	/** Has a part such as [id], so it is reached from another page rather than linked here. */
	dynamic: boolean;
	children: MapPage[];
}

/** A route file, such as /src/routes/(protected)/staff/calls/[id]/+page.svelte, as its address and whether it needs login. */
export function routeOf(file: string): { route: string; login: boolean } {
	const parts = file.replace(/^.*\/src\/routes/, '').replace(/\/\+page\.svelte$/, '').split('/').filter(Boolean);
	return { route: '/' + parts.filter((p) => !/^\(.*\)$/.test(p)).join('/'), login: parts.includes('(protected)') };
}

export function audienceOf(route: string, login: boolean): Audience {
	if (!login) return 'everyone';
	if (route === '/staff' || route.startsWith('/staff/')) return 'staff';
	if (route === '/review' || route.startsWith('/review/')) return 'reviewers';
	return 'applicants';
}

/** The pages of each audience as trees: a page sits under the longest other page whose address starts its own. */
export function buildSitemap(files: string[]): Record<Audience, MapPage[]> {
	const pages = files.map(routeOf).sort((a, b) => a.route.localeCompare(b.route));
	const result = Object.fromEntries(AUDIENCES.map((a) => [a, [] as MapPage[]])) as Record<Audience, MapPage[]>;
	const nodes = new Map<string, MapPage>();
	for (const p of pages) {
		const node: MapPage = { route: p.route, login: p.login, dynamic: p.route.includes('['), children: [] };
		const audience = audienceOf(p.route, p.login);
		const parent = [...nodes.values()]
			.filter((n) => n.route !== '/' && p.route.startsWith(n.route + '/') && audienceOf(n.route, n.login) === audience)
			.sort((a, b) => b.route.length - a.route.length)[0];
		(parent ? parent.children : result[audience]).push(node);
		nodes.set(p.route, node);
	}
	return result;
}
