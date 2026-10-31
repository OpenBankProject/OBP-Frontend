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
import type { SystemDynamicEntityDefinition } from '@obp/shared/server/obp';

/**
 * The Dynamic Entities Cohort keeps in its space. Cohort creates them at startup and adds new properties
 * to them; properties are never renamed, retyped or removed (see DESIGN_DECISIONS.md).
 */

export const PROGRAMME = 'cohort_programme';
export const CALL = 'cohort_call';
export const APPLICATION = 'cohort_application';

const text = (example: string, description: string, maxLength = 255, minLength = 0) => ({
	type: 'string',
	...(minLength ? { minLength } : {}),
	maxLength,
	example,
	description
});

/** A programme the hub runs, e.g. an incubation or acceleration track. Public: the website lists them. */
export const programmeEntity: SystemDynamicEntityDefinition = {
	entity_name: PROGRAMME,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	auth_mode: 'UserOnly',
	schema: {
		description: 'A programme of the innovation hub, e.g. an incubation or acceleration track.',
		required: ['name', 'status'],
		properties: {
			name: text('Fintech Acceleration 2027', 'The name of the programme.', 255, 1),
			description: text('A six-month programme for fintech startups.', 'What the programme offers.', 4000),
			status: text('open', 'draft, open or closed.', 20, 1),
			starts_on: text('2027-01-15', 'First day (YYYY-MM-DD).', 10),
			ends_on: text('2027-07-15', 'Last day (YYYY-MM-DD).', 10)
		}
	}
};

/** A call for applications to a programme. Public: applicants find open calls on the website. */
export const callEntity: SystemDynamicEntityDefinition = {
	entity_name: CALL,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	auth_mode: 'UserOnly',
	schema: {
		description: 'A call for applications to a programme.',
		required: ['programme_id', 'title', 'status'],
		properties: {
			programme_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_programme this call is for.', 36, 1),
			title: text('Cohort 1 - spring 2027', 'The title applicants see.', 255, 1),
			description: text('Applications are open to fintech startups.', 'What the call is looking for.', 4000),
			status: text('open', 'draft, open or closed.', 20, 1),
			opens_at: text('2026-11-01', 'When applications open (YYYY-MM-DD).', 10),
			closes_at: text('2026-12-15', 'When applications close (YYYY-MM-DD).', 10)
		}
	}
};

/**
 * An application to a call. Personal: each applicant creates, saves and resumes their own, with no Role.
 * Community: staff holding CanGetDynamicEntityRecord_cohort_application at the space read every application.
 * Staff decisions are separate records, never edits to the applicant's own.
 */
export const applicationEntity: SystemDynamicEntityDefinition = {
	entity_name: APPLICATION,
	has_personal_entity: true,
	personal_requires_role: false,
	has_public_access: false,
	has_community_access: true,
	auth_mode: 'UserOnly',
	schema: {
		description: 'An application to a call, owned by the applicant. Saved as a draft until it is submitted.',
		required: ['call_id', 'status'],
		properties: {
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_call applied to.', 36, 1),
			status: text('draft', 'draft or submitted.', 20, 1),
			startup_name: text('Example Pay', 'The name of the startup or project.'),
			sector: text('payments', 'The fintech sector, e.g. payments, lending, regtech.', 100),
			stage: text('mvp', 'idea, mvp, early_revenue or growth.', 20),
			website: text('https://example.com', 'The startup website, if any.', 500),
			problem_statement: text('Small merchants cannot accept card payments cheaply.', 'The problem the startup solves.', 4000),
			solution: text('A QR payment app with low fees.', 'The proposed solution.', 4000),
			market_understanding: text('Most small merchants still only take cash.', 'Understanding of the local market.', 4000),
			team_size: { type: 'integer', example: 3, description: 'How many people are on the team.' },
			local_resident: { type: 'boolean', example: true, description: "The applicant is a citizen or resident of the programme's country." },
			incorporated_locally: { type: 'boolean', example: false, description: "The business is incorporated in the programme's country." },
			eligibility: text('eligible', 'Set on submission: eligible or needs_review.', 20),
			submitted_at: text('2026-11-20T10:00:00Z', 'When the application was submitted (ISO 8601, UTC).', 30)
		}
	}
};

export const COHORT_ENTITIES: SystemDynamicEntityDefinition[] = [programmeEntity, callEntity, applicationEntity];
