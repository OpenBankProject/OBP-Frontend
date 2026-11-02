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
 * Platform Apps: the apps an installation runs as part of its OBP deployment (here the Portal, the
 * API Manager and OBP-Cohort; elsewhere Opey, OBP-MCP or a bank's own services), each calling OBP as its
 * own Consumer with an application token (client credentials, no User).
 *
 * The Scopes the Portal's, the API Manager's and OBP-Cohort's Consumers need are listed here (Cohort's
 * depend on its space, so they come from cohortRequiredConsumerScopes). Each app's
 * "OBP Consumer scopes" check on /status compares the list with the Scopes its Consumer holds, and
 * declares it to OBP (PUT /obp/v7.0.0/consumers/current/platform-app) once an administrator has marked
 * the Consumer as a Platform App; the API Manager's Platform Apps page reads every app's declaration
 * from OBP and grants what is missing. Add a line here when an app starts making a new
 * application-token call.
 */
import { DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID } from './dynamicEntitySpace.js';

/** The Platform Apps in this repository. */
export type PlatformApp = 'portal' | 'api-manager' | 'cohort';

export interface RequiredConsumerScope {
	role_name: string;
	/** A bank id, SYS for the system space, or '' for a system Role. */
	bank_id: string;
	/** The features that depend on it, as the admin would recognise them. */
	needed_for: string;
	/** Nice to have: something else covers for it (e.g. the API Manager creates the entity instead). */
	optional?: boolean;
}

const SYS = DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID;

export const REQUIRED_CONSUMER_SCOPES: Record<Exclude<PlatformApp, 'cohort'>, RequiredConsumerScope[]> = {
	portal: [
		{
			role_name: 'CanGetDynamicEntityRecord_obp_portal_page',
			bank_id: SYS,
			needed_for: 'Showing the pages published with App Studio at /pages, to every visitor.'
		},
		{
			role_name: 'CanUpdateDynamicEntityRecord_obp_developer_faq',
			bank_id: SYS,
			needed_for: 'Linking each FAQ chat room to its question.'
		},
		{
			role_name: 'CanGetDynamicEntityDefinitions',
			bank_id: SYS,
			needed_for: 'Recording Opey conversations, if the API Manager has not already created their entity.',
			optional: true
		},
		{
			role_name: 'CanCreateDynamicEntityDefinition',
			bank_id: SYS,
			needed_for: 'Recording Opey conversations, if the API Manager has not already created their entity.',
			optional: true
		}
	],
	'api-manager': [
		{
			role_name: 'CanGetDynamicEntityDefinitions',
			bank_id: SYS,
			needed_for: 'App Studio, the Portal FAQ, Reports and Opey conversation recording, whose entities it maintains.'
		},
		{
			role_name: 'CanCreateDynamicEntityDefinition',
			bank_id: SYS,
			needed_for: 'Setting those features up on a new installation.'
		},
		{
			role_name: 'CanUpdateDynamicEntityDefinition',
			bank_id: SYS,
			needed_for: 'Keeping those features working after an upgrade.'
		}
	]
};

/**
 * The Scopes OBP-Cohort's Consumer needs. Cohort keeps its records in one space per installation (its
 * OBP_ENTITY_SPACE_ID: a bank id, or SYS), so the Scopes name that space rather than a fixed one.
 */
export function cohortRequiredConsumerScopes(space: string): RequiredConsumerScope[] {
	return [
		{
			role_name: 'CanGetDynamicEntityDefinitions',
			bank_id: space,
			needed_for: "Checking that Cohort's entities (application forms, reviews, milestones, sessions) exist in its space."
		},
		{
			role_name: 'CanCreateDynamicEntityDefinition',
			bank_id: space,
			needed_for: "Creating Cohort's entities on a new installation. Staff publish forms with their own Role."
		},
		{
			role_name: 'CanUpdateDynamicEntityDefinition',
			bank_id: space,
			needed_for: "Adding fields to Cohort's entities after an upgrade."
		},
		{
			role_name: 'CanGetDynamicEntityRecord_cohort_screening_decision',
			bank_id: space,
			needed_for: 'Showing applicants the outcome of screening on their own application.'
		},
		{
			role_name: 'CanGetDynamicEntityRecord_cohort_reviewer_decision',
			bank_id: space,
			needed_for: 'Showing reviewers their assignments only once staff have accepted their offer to review.'
		},
		{
			role_name: 'CanGetDynamicEntityRecord_cohort_participant',
			bank_id: space,
			needed_for: 'Showing a startup its own place in the programme (onboarding itself is done with the staff member\'s Roles).'
		},
		{
			role_name: 'CanGetDynamicEntityRecord_cohort_milestone_review',
			bank_id: space,
			needed_for: 'Showing a startup the outcome of its own milestone reports (staff review them with their own Roles).'
		},
		{
			role_name: 'CanGetDynamicEntityRecord_cohort_application',
			bank_id: space,
			needed_for: 'Reminding applicants, on its own, when a call they have a draft for is closing (never shown to anyone).'
		},
		{
			role_name: 'CanGetDynamicEntityRecord_cohort_milestone_report',
			bank_id: space,
			needed_for: 'Reminding startups, on its own, of milestones due or overdue (never shown to anyone).'
		},
		{
			role_name: 'CanGetDynamicEntityRecord_cohort_session',
			bank_id: space,
			needed_for: "Showing a startup its own programme's sessions to book."
		},
		{
			role_name: 'CanGetDynamicEntityRecord_cohort_session_booking',
			bank_id: space,
			needed_for: 'Counting the seats taken on a session when a startup books (who booked is never shown).'
		},
		{
			role_name: 'CanGetDynamicEntityRecord_cohort_attendance',
			bank_id: space,
			needed_for: 'Showing a startup the sessions it attended.'
		},
		{
			role_name: 'CanCreateDynamicEntityRecord_cohort_reminder',
			bank_id: space,
			needed_for: 'Recording each reminder it emails, so none is sent twice.'
		},
		{
			role_name: 'CanGetDynamicEntityRecord_cohort_reminder',
			bank_id: space,
			needed_for: 'Knowing which reminders it has already sent.'
		},
		{
			role_name: 'CanUpdateDynamicEntityRecord_cohort_participant',
			bank_id: space,
			needed_for: "Recording the company a startup registers during onboarding."
		},
		{
			role_name: 'CanCreateCustomer',
			bank_id: space,
			needed_for: 'Registering each applicant as a Customer of the space (the legal person behind the login), and later each accepted startup.'
		},
		{
			role_name: 'CanCreateUserCustomerLink',
			bank_id: space,
			needed_for: "Linking applicants, and later a startup's team, to their Customer."
		},
		{
			role_name: 'CanSendEmailToCustomerAtOneBank',
			bank_id: space,
			needed_for: 'Emailing applicants (Customers of the space) that their application was received, and when there is a decision.'
		}
	];
}

export interface HeldScope {
	role_name: string;
	bank_id: string;
}

export interface ConsumerScopeStatus extends RequiredConsumerScope {
	held: boolean;
}

/** Each required Scope, marked held or not. A Scope counts only at the bank id it is required at. */
export function compareConsumerScopes(required: RequiredConsumerScope[], held: HeldScope[]): ConsumerScopeStatus[] {
	return required.map((r) => ({
		...r,
		held: held.some((h) => h.role_name === r.role_name && (h.bank_id ?? '') === r.bank_id)
	}));
}

/**
 * The Scopes the Consumer holds that the app does not ask for (at any bank id), e.g. after the app stopped needing
 * one. Each is listed once, in OBP's order. An administrator can remove them on the Platform Apps page.
 */
export function excessConsumerScopes(required: RequiredConsumerScope[], held: HeldScope[]): HeldScope[] {
	const wanted = new Set(required.map((r) => `${r.role_name}@${r.bank_id}`));
	const seen = new Set<string>();
	return held
		.map((h) => ({ role_name: h.role_name, bank_id: h.bank_id ?? '' }))
		.filter((h) => {
			const key = `${h.role_name}@${h.bank_id}`;
			if (wanted.has(key) || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
}

/** The result of an app's check of its own Consumer. */
export interface ConsumerScopesReport {
	checked_at: string;
	/** 'ok': every required Scope is held; 'missing': some are not; 'unknown': the check could not tell. */
	state: 'ok' | 'missing' | 'unknown';
	consumer_id?: string;
	scopes: ConsumerScopeStatus[];
	/** Scopes held but not asked for; absent when the state is unknown. */
	excess?: HeldScope[];
	/** Why the state is unknown, or which call failed. */
	problem?: string;
}
