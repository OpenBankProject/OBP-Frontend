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
import { env } from '$env/dynamic/private';
import { dynamicEntityDataPath } from '@obp/shared/obp';
import { appSupplementaryPromptFromEnv } from '@obp/shared/server/opey';
import type { SystemDynamicEntityDefinition } from '@obp/shared/server/obp';
import { COHORT_ENTITIES, OPEY_CONVERSATION } from './entities/definitions';
import { cohortFormsSpace, cohortSpace } from './space';

/** How one dynamic entity's records are read: who may, and at which URL. */
function readsOf(d: SystemDynamicEntityDefinition, base: string, space: string): string[] {
	const name = d.entity_name;
	const role = `CanGetDynamicEntityRecord_${name} at bank_id ${space}`;
	const reads: string[] = [];
	if (d.has_public_access) reads.push(`anyone: GET ${base}/public/${name}`);
	if (d.has_personal_entity) reads.push(`the user's own records: GET ${base}/my/${name}`);
	if (d.has_community_access) reads.push(`every user's records (needs ${role}): GET ${base}/community/${name}`);
	if (!d.has_public_access && !d.has_community_access) reads.push(`staff only (needs ${role}): GET ${base}/${name}`);
	return reads;
}

/**
 * What Opey is told, with each message, about where Cohort's data is: the bank_id of Cohort's space and each of its
 * dynamic entities, what it holds and how its records are read. Only names and URLs: Opey reads the records itself,
 * with the user's own consent, so it sees no more than the user may.
 */
export function opeyGuide(
	space = cohortSpace(),
	formsSpace = cohortFormsSpace(),
	entities: SystemDynamicEntityDefinition[] = COHORT_ENTITIES
): string {
	const base = dynamicEntityDataPath(space);
	const lines = entities
		.filter((d) => d.entity_name !== OPEY_CONVERSATION)
		.map((d) => `- ${d.entity_name}: ${d.schema?.description ?? ''} Read by ${readsOf(d, base, space).join('; ')}.`);
	return [
		`You are helping people use Cohort, a startup programme: programmes, the calls for applications to them, ` +
			`and the applications startups make. Cohort's data are OBP dynamic entities at bank_id "${space}". ` +
			`Answer questions about programmes, calls and applications from the records of those dynamic entities, ` +
			`read with the OBP API (GET, at bank_id "${space}"), not from general knowledge or memory. Say so when a ` +
			`record is not found or the user lacks the Role to read it, and never invent programmes, calls, dates or ` +
			`outcomes.`,
		`Where to look:`,
		`- Programmes (what a programme is, its stages, milestones and sessions): cohort_programme; its ` +
			`cohort_milestone and cohort_session records name it in programme_id.`,
		`- Calls for applications (what is open, who may apply, deadlines, how applications are scored, the ` +
			`questions asked): cohort_call (open between opens_at and closes_at; its programme in programme_id); ` +
			`its cohort_rubric_criterion and cohort_form records name it in call_id.`,
		`- Applications (the user's own drafts and submissions, their status and outcome): cohort_application ` +
			`(the user's own at /my/; its call in call_id); its outcome is the cohort_screening_decision whose ` +
			`application_id is the application's id (staff read it; an applicant sees their own outcome on their ` +
			`application's page in Cohort, /applications/<id>); answers to the call's extra questions are in the form's own ` +
			`dynamic entity (named in the cohort_form's entity_name) at bank_id "${formsSpace}", with subject_id the ` +
			`application's id.`,
		`Each record's id is in its <entity name>_id field; append /<id> to a URL to read one record. Lists can be ` +
			`filtered by a field with ?<field>=<value>, e.g. ?call_id=<id>.`,
		`Cohort's dynamic entities:`,
		...lines,
		`The answers to published forms (application questions and surveys) are dynamic entities named ` +
			`cohort_form_<id> at bank_id "${formsSpace}"; the cohort_form record (above) names its own in entity_name.`
	].join('\n');
}

/**
 * Cohort's app_supplementary_prompt for Opey: the installation's own focus (OPEY_APP_SUPPLEMENTARY_PROMPT, or the file
 * named by OPEY_APP_SUPPLEMENTARY_PROMPT_FILE, read per message), then where Cohort's data is.
 */
export function cohortOpeyPrompt(): string {
	return [appSupplementaryPromptFromEnv(env), opeyGuide()].filter(Boolean).join('\n\n');
}
