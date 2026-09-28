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
 * The Scopes each app's own OBP Consumer needs, for the calls it makes with its application token
 * (client credentials, no User). One list, read by the startup code's warnings, by each app's
 * "OBP Consumer scopes" check on /status, and by the API Manager's App Consumers page, which grants
 * what is missing. Add a line here when an app starts making a new application-token call.
 */
import { DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID } from './dynamicEntitySpace.js';

export type ConsumerApp = 'portal' | 'api-manager';

export interface RequiredConsumerScope {
	role_name: string;
	/** A bank id, SYS for the system space, or '' for a system Role. */
	bank_id: string;
	/** What the app uses it for. */
	purpose: string;
	/** What stops working without it. */
	without_it: string;
	/** Nice to have: something else covers for it (e.g. the API Manager creates the entity instead). */
	optional?: boolean;
}

const SYS = DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID;

export const CONSUMER_APP_LABELS: Record<ConsumerApp, string> = {
	portal: 'Portal',
	'api-manager': 'API Manager'
};

export const REQUIRED_CONSUMER_SCOPES: Record<ConsumerApp, RequiredConsumerScope[]> = {
	portal: [
		{
			role_name: 'CanGetDynamicEntityRecord_obp_portal_page',
			bank_id: SYS,
			purpose: 'Reads the pages published with App Studio, for visitors who are not logged in.',
			without_it: '/pages and every published page stay unavailable.'
		},
		{
			role_name: 'CanUpdateDynamicEntityRecord_obp_developer_faq',
			bank_id: SYS,
			purpose: "Records a question's chat room on its FAQ item.",
			without_it: 'Each FAQ chat room is created but not linked to its question.'
		},
		{
			role_name: 'CanGetDynamicEntityDefinitions',
			bank_id: SYS,
			purpose: 'Finds its Opey conversation entity at startup.',
			without_it: 'Nothing, while the API Manager creates the entity at its own startup.',
			optional: true
		},
		{
			role_name: 'CanCreateDynamicEntityDefinition',
			bank_id: SYS,
			purpose: 'Creates its Opey conversation entity at startup if it is missing.',
			without_it: 'Nothing, while the API Manager creates the entity at its own startup.',
			optional: true
		}
	],
	'api-manager': [
		{
			role_name: 'CanGetDynamicEntityDefinitions',
			bank_id: SYS,
			purpose: 'Finds the system dynamic entities it maintains at startup (obp_portal_page, obp_developer_faq, obp_report, Opey conversations).',
			without_it: 'None of them is created or updated: App Studio, the Portal FAQ, Reports and Opey conversation recording fail until they exist.'
		},
		{
			role_name: 'CanCreateDynamicEntityDefinition',
			bank_id: SYS,
			purpose: 'Creates those entities when they are missing.',
			without_it: 'A missing entity stays missing.'
		},
		{
			role_name: 'CanUpdateDynamicEntityDefinition',
			bank_id: SYS,
			purpose: 'Brings an entity up to date when its auth mode or schema falls behind.',
			without_it: 'An out-of-date entity stays as it is.'
		}
	]
};

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
 * What an app reports about its own Consumer, served as JSON at /status/consumer-scopes so the
 * API Manager can show it. consumer_id only: the client id (consumer key) is a credential.
 */
export interface ConsumerScopesReport {
	app: ConsumerApp;
	checked_at: string;
	/** 'ok': every required Scope is held; 'missing': some are not; 'unknown': the check could not tell. */
	state: 'ok' | 'missing' | 'unknown';
	consumer_id?: string;
	scopes: ConsumerScopeStatus[];
	/** Why the state is unknown, or which call failed. */
	problem?: string;
}
