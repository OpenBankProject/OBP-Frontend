/*
 * Copyright (C) 2026 TESOBE GmbH
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
 * The dynamic entities of OBP-Conformator. The central ones live in the central space and the app creates them
 * at startup. The participant ones live in each participant's own space, created when an administrator sets that space
 * up. Definitions only grow: properties are added, never renamed, retyped or removed (see DESIGN_DECISIONS.md).
 */

// Central space: the catalogue.
export const REQUIREMENT = 'conformator_requirement';
export const SUITE = 'conformator_suite';
export const TEST = 'conformator_test';
// Central space: participants and reports.
export const PARTICIPANT = 'conformator_participant';
export const PARTICIPANT_DECISION = 'conformator_participant_decision';
export const REPORT = 'conformator_report';
export const REPORT_EVENT = 'conformator_report_event';
// Participant's space: what the participant records.
export const SYSTEM = 'conformator_system';
export const PAIRING = 'conformator_pairing';
export const RUN = 'conformator_run';
export const RESULT = 'conformator_result';
export const SCHEDULE = 'conformator_schedule';
export const SUBMISSION = 'conformator_submission';
export const EVIDENCE = 'conformator_evidence';
export const WAIVER_REQUEST = 'conformator_waiver_request';
export const APPEAL = 'conformator_appeal';
// Participant's space: what the regulator records.
export const REVIEW_ASSIGNMENT = 'conformator_review_assignment';
export const ASSESSMENT = 'conformator_assessment';
export const WAIVER_DECISION = 'conformator_waiver_decision';
export const APPEAL_DECISION = 'conformator_appeal_decision';
export const APPROVAL = 'conformator_approval';

const text = (example: string, description: string, maxLength = 255, minLength = 0) => ({
	type: 'string',
	...(minLength ? { minLength } : {}),
	maxLength,
	example,
	description
});
const id = (example: string, description: string) => text(example, description, 64);
const date = (example: string, description: string) => text(example, `${description} (YYYY-MM-DD).`, 10);
const time = (example: string, description: string) => text(example, `${description} (ISO 8601, UTC).`, 30);
const integer = (example: number, description: string) => ({ type: 'integer', example, description });
const boolean = (example: boolean, description: string) => ({ type: 'boolean', example, description });

function entity(
	name: string,
	description: string,
	required: string[],
	properties: Record<string, unknown>,
	access: { public?: boolean } = {}
): SystemDynamicEntityDefinition {
	return {
		entity_name: name,
		has_personal_entity: false,
		has_public_access: access.public ?? false,
		has_community_access: false,
		schema: { description, required, properties }
	};
}

// ---- Central space ----

export const requirementEntity = entity(
	REQUIREMENT,
	'One clause of the regulatory framework that tests can be traced to.',
	['reference', 'title'],
	{
		reference: text('OBRF 4.2.1', 'The clause reference in the source document.', 64, 1),
		title: text('Consent expiry', 'A short title.', 255, 1),
		wording: text('A consent shall state its expiry date ...', 'The wording of the clause.', 8000),
		source_document: text('Open Banking Regulatory Framework', 'The document the clause comes from.', 255),
		source_version: text('1.0', 'The version of that document.', 32)
	},
	{ public: true }
);

export const suiteEntity = entity(
	SUITE,
	'A versioned set of tests for one participant role and API family. An approved version never changes.',
	['code', 'name', 'version', 'system_role', 'api_family', 'status'],
	{
		code: text('AIS-PROVIDER', 'A short code that stays the same across versions.', 32, 1),
		name: text('Account information: API provider', 'The name of the suite.', 255, 1),
		version: text('1.0.0', 'The version of this suite.', 32, 1),
		system_role: text('api_provider', 'api_provider, authorisation_server or api_consumer.', 32, 1),
		api_family: text('account_information', 'account_information, payment_initiation, funds_confirmation, consent or security.', 32, 1),
		status: text('draft', 'draft, approved or retired.', 16, 1),
		description: text('Tests for banks that provide account information APIs.', 'What the suite covers.', 4000),
		replaces_suite_id: id('', 'The suite version this one replaces, if any.'),
		openapi_url: text('https://regulator.example/open-banking/ais-1.0.json', "The OpenAPI 3.1 document (JSON) whose schemas the suite's tests check responses against.", 500),
		source_kind: text('obp_version', 'What the suite tests: obp_version (a standard OBP implements), openapi_url (an OpenAPI file at a URL), openapi_dynamic (an OpenAPI file loaded into OBP as dynamic endpoints), or empty.', 32),
		obp_api_version: text('UKv3.1', 'For obp_version: the OBP API version, as OBP names it, such as UKv3.1 or BGv1.3.', 64),
		dynamic_endpoint_id: id('', 'For openapi_dynamic: the dynamic endpoint set in the central space that holds the file.')
	},
	{ public: true }
);

export const testEntity = entity(
	TEST,
	'One test in a suite version: what it checks, which requirements it covers and what counts as a pass.',
	['test_id', 'suite_id', 'title', 'kind', 'mandatory', 'severity'],
	{
		test_id: text('AIS-CON-001', 'The test ID, such as PIS-IDEM-004. It never changes.', 64, 1),
		suite_id: id('', 'The suite version the test belongs to.'),
		title: text('Consent can be created, read and revoked', 'A short title.', 255, 1),
		kind: text('automated', 'automated, evidence or control.', 16, 1),
		mandatory: boolean(true, 'Whether passing this test is required.'),
		severity: text('high', 'critical, high, medium or low.', 16, 1),
		requirement_ids: text('[]', 'The requirements the test covers, as a JSON list of requirement ids.', 4000),
		expected_result: text('The consent is revoked and later calls are refused.', 'What a pass looks like.', 4000),
		evidence_required: text('', 'The evidence a participant must supply, for evidence and control tests.', 4000),
		suggested_fix: text('', 'What a participant should do when the test fails.', 4000),
		definition: text('{"steps":[]}', 'The steps of an automated test, as JSON.', 20000),
		position: integer(1, 'The order of the test in its suite.')
	},
	{ public: true }
);

export const participantEntity = entity(
	PARTICIPANT,
	'An organisation taking part: a bank, payment service provider, fintech, finance or leasing company, or third-party provider.',
	['legal_name', 'category', 'space_id'],
	{
		legal_name: text('Example Bank SAOG', 'The legal name of the organisation.', 255, 1),
		category: text('bank', 'bank, payment_service_provider, fintech, finance_or_leasing or third_party_provider.', 32, 1),
		space_id: text('conformator-example-bank', "The bank id of the participant's own space.", 64, 1),
		customer_id: id('', 'The CORPORATE Customer for the organisation, once created.'),
		consumer_id: id('', "The participant's sandbox Consumer, once registered."),
		organisation_id: id('', "The participant's Organisation in OBP-API: its people, whose members get the participant's Roles in its space."),
		is_reference: boolean(false, 'Whether this is the OBP sandbox itself, which suites are run against before participants use them.')
	}
);

export const participantDecisionEntity = entity(
	PARTICIPANT_DECISION,
	"A step in a participant's lifecycle, recorded by the regulator. The latest one is the current stage.",
	['participant_id', 'stage', 'reason'],
	{
		participant_id: id('', 'The participant.'),
		stage: text('admitted', 'admitted, onboarding, testing, remediation, graduated, suspended or exited.', 16, 1),
		reason: text('Licence application received.', 'Why.', 4000, 1),
		decided_at: time('2026-11-11T10:00:00Z', 'When')
	}
);

export const reportEntity = entity(
	REPORT,
	'An issued conformance report. Public by reference, so anyone can check one.',
	['reference', 'participant_id', 'suite_id', 'issued_on', 'expires_on', 'report_hash'],
	{
		reference: text('CR-2026-000123', 'The unique reference of the report.', 32, 1),
		participant_id: id('', 'The participant.'),
		system_id: id('', 'The system tested, in the participant space.'),
		suite_id: id('', 'The suite version tested.'),
		submission_id: id('', 'The submission the report is for, in the participant space.'),
		issued_on: date('2026-11-11', 'When it was issued'),
		expires_on: date('2027-11-11', 'When it expires'),
		report_hash: text('sha256:...', 'The hash of the canonical report.', 128, 1),
		signature: text('', 'The signature over the hash.', 4000),
		signing_key_id: text('', 'The id of the key that signed it.', 255),
		content: text('{}', 'The report itself, as canonical JSON: what the hash and signature cover.', 60000)
	},
	{ public: true }
);

export const reportEventEntity = entity(
	REPORT_EVENT,
	'A report superseded or withdrawn. Expiry follows from the date and is not recorded.',
	['report_id', 'event', 'reason'],
	{
		report_id: id('', 'The report.'),
		event: text('withdrawn', 'superseded or withdrawn.', 16, 1),
		reason: text('Superseded by CR-2026-000150.', 'Why.', 4000, 1),
		replaced_by_report_id: id('', 'The report that replaces it, when superseded.')
	},
	{ public: true }
);

export const CENTRAL_ENTITIES: SystemDynamicEntityDefinition[] = [
	requirementEntity,
	suiteEntity,
	testEntity,
	participantEntity,
	participantDecisionEntity,
	reportEntity,
	reportEventEntity
];

// ---- Participant's space ----

export const systemEntity = entity(
	SYSTEM,
	'A non-production system of the participant to be tested. Holds no secrets.',
	['name', 'system_role', 'base_url'],
	{
		name: text('Open banking sandbox', 'A name for the system.', 255, 1),
		system_role: text('api_provider', 'api_provider, authorisation_server or api_consumer.', 32, 1),
		base_url: text('https://sandbox.bank.example/open-banking/v1', 'The base URL of its APIs.', 500, 1),
		discovery_url: text('https://auth.bank.example/.well-known/openid-configuration', 'Its OpenID discovery URL, if any.', 500),
		api_profile: text('account_information', 'The API profile it implements.', 64),
		api_version: text('1.0', 'The version of that profile.', 32),
		runner_client_id: text('', "The client id the participant's sandbox issued to the runner.", 255)
	}
);

export const pairingEntity = entity(
	PAIRING,
	'An agreement between two participants to be tested together, needed for interoperability tests.',
	['system_id', 'other_participant_id', 'other_system_id'],
	{
		system_id: id('', "This participant's system."),
		other_participant_id: id('', 'The other participant.'),
		other_system_id: id('', "The other participant's system."),
		accepted_by_other_participant: boolean(false, 'Whether the other participant has accepted.')
	}
);

export const runEntity = entity(
	RUN,
	'One execution of a suite version against a system.',
	['system_id', 'suite_id', 'trigger', 'status'],
	{
		system_id: id('', 'The system tested.'),
		suite_id: id('', 'The suite version run.'),
		other_system_id: id('', 'The other system, for interoperability runs.'),
		submission_id: id('', 'The submission it counts for; empty for a practice run.'),
		trigger: text('person', 'person, ci, schedule or rerun.', 16, 1),
		status: text('queued', 'queued, running, finished or harness_error.', 16, 1),
		problem: text('', 'Why the run ended as harness_error.', 4000),
		runner_version: text('', 'The version of the runner that ran it.', 64),
		started_at: time('', 'When it started'),
		finished_at: time('', 'When it finished')
	}
);

export const resultEntity = entity(
	RESULT,
	'The outcome of one test in one run. Never changed.',
	['run_id', 'test_id', 'outcome'],
	{
		run_id: id('', 'The run.'),
		test_id: text('AIS-CON-001', 'The test ID.', 64, 1),
		outcome: text('pass', 'pass, fail, blocked, not_executed or not_applicable.', 16, 1),
		blocked_by: text('', 'For a blocked test: harness or participant.', 16),
		blocked_because_test_id: text('', 'For a test blocked by an earlier failure: that test.', 64),
		severity: text('high', 'The severity of the test.', 16),
		expected: text('', 'What the test expected.', 4000),
		actual: text('', 'What happened.', 4000),
		correlation_ids: text('[]', 'The correlation ids of the calls made, as a JSON list.', 4000),
		exchanges: text('[]', 'The requests and responses, cleaned of secrets, as a JSON list.', 60000),
		started_at: time('', 'When it started'),
		finished_at: time('', 'When it finished')
	}
);

export const scheduleEntity = entity(
	SCHEDULE,
	'Regular runs of a suite against a system, for regression checks.',
	['system_id', 'suite_code', 'every_hours', 'enabled'],
	{
		system_id: id('', 'The system.'),
		suite_code: text('AIS-PROVIDER', 'The suite, by code: each run uses its latest approved version.', 32, 1),
		every_hours: integer(24, 'How often, in hours.'),
		enabled: boolean(true, 'Whether the schedule is on.')
	}
);

export const submissionEntity = entity(
	SUBMISSION,
	"A system put forward for the regulator's review against a suite version.",
	['system_id', 'suite_id'],
	{
		system_id: id('', 'The system.'),
		suite_id: id('', 'The suite version.'),
		run_ids: text('[]', 'The runs that count, as a JSON list.', 4000),
		note: text('', 'A note for the reviewer.', 4000),
		submitted_at: time('', 'When it was submitted')
	}
);

export const evidenceEntity = entity(
	EVIDENCE,
	'Evidence for an evidence or control test. Files are attached to the record.',
	['submission_id', 'test_id', 'note'],
	{
		submission_id: id('', 'The submission.'),
		test_id: text('GOV-LOG-001', 'The test ID.', 64, 1),
		note: text('Our audit log retention policy is attached.', 'What the evidence shows.', 4000, 1)
	}
);

export const waiverRequestEntity = entity(
	WAIVER_REQUEST,
	'A request to waive one test.',
	['submission_id', 'test_id', 'reason'],
	{
		submission_id: id('', 'The submission.'),
		test_id: text('PIS-IDEM-004', 'The test ID.', 64, 1),
		reason: text('', 'Why the test should be waived.', 4000, 1),
		requested_until: date('', 'How long the waiver is wanted for')
	}
);

export const appealEntity = entity(
	APPEAL,
	'A challenge to a result or a decision. The original is never changed.',
	['about_entity', 'about_id', 'reason'],
	{
		about_entity: text('conformator_result', 'What is challenged: a result, an assessment or an approval.', 64, 1),
		about_id: id('', 'Its id.'),
		reason: text('', 'Why it is wrong.', 4000, 1)
	}
);

export const reviewAssignmentEntity = entity(
	REVIEW_ASSIGNMENT,
	'A reviewer assigned to a submission.',
	['submission_id', 'reviewer_user_id'],
	{
		submission_id: id('', 'The submission.'),
		reviewer_user_id: id('', 'The reviewer.')
	}
);

export const assessmentEntity = entity(
	ASSESSMENT,
	"A reviewer's verdict on an evidence or control test, or on a disputed automated result.",
	['submission_id', 'test_id', 'outcome', 'reason'],
	{
		submission_id: id('', 'The submission.'),
		test_id: text('GOV-LOG-001', 'The test ID.', 64, 1),
		outcome: text('pass', 'pass, fail or not_applicable.', 16, 1),
		reason: text('', 'Why.', 4000, 1)
	}
);

export const waiverDecisionEntity = entity(
	WAIVER_DECISION,
	'The decision on a waiver request. An approved waiver expires and shows on every report it affects.',
	['waiver_request_id', 'approved', 'reason'],
	{
		waiver_request_id: id('', 'The request.'),
		approved: boolean(false, 'Whether it is approved.'),
		expires_on: date('', 'When an approved waiver ends'),
		reason: text('', 'Why.', 4000, 1)
	}
);

export const appealDecisionEntity = entity(
	APPEAL_DECISION,
	'The outcome of an appeal.',
	['appeal_id', 'upheld', 'reason'],
	{
		appeal_id: id('', 'The appeal.'),
		upheld: boolean(false, 'Whether the appeal succeeds.'),
		reason: text('', 'Why.', 4000, 1)
	}
);

export const approvalEntity = entity(
	APPROVAL,
	'The final decision on a submission. Only the approver Role creates it.',
	['submission_id', 'approved', 'reason'],
	{
		submission_id: id('', 'The submission.'),
		approved: boolean(true, 'Whether the submission is approved.'),
		reason: text('', 'Why.', 4000, 1)
	}
);

export const PARTICIPANT_ENTITIES: SystemDynamicEntityDefinition[] = [
	systemEntity,
	pairingEntity,
	runEntity,
	resultEntity,
	scheduleEntity,
	submissionEntity,
	evidenceEntity,
	waiverRequestEntity,
	appealEntity,
	reviewAssignmentEntity,
	assessmentEntity,
	waiverDecisionEntity,
	appealDecisionEntity,
	approvalEntity
];

/** The participant entities the participant's own users write. The rest are written by the regulator. */
export const PARTICIPANT_WRITES = [SYSTEM, PAIRING, RUN, SCHEDULE, SUBMISSION, EVIDENCE, WAIVER_REQUEST, APPEAL];
