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
import { PORTAL_OPEY_CONVERSATION_ENTITY } from '@obp/shared/opey';
import type { SystemDynamicEntityDefinition } from '@obp/shared/server/obp';

/**
 * The Dynamic Entities Cohort keeps in its space. Cohort creates them at startup and adds new properties
 * to them; properties are never renamed, retyped or removed (see DESIGN_DECISIONS.md).
 */

export const PROGRAMME = 'cohort_programme';
export const CALL = 'cohort_call';
export const APPLICATION = 'cohort_application';
export const SCREENING_DECISION = 'cohort_screening_decision';
export const OPEY_CONVERSATION = 'cohort_opey_conversation';
export const RUBRIC_CRITERION = 'cohort_rubric_criterion';
export const REVIEWER = 'cohort_reviewer';
export const REVIEWER_DECISION = 'cohort_reviewer_decision';
export const REVIEW_ASSIGNMENT = 'cohort_review_assignment';
export const REVIEW = 'cohort_review';
export const PARTICIPANT = 'cohort_participant';
export const MILESTONE = 'cohort_milestone';
export const MILESTONE_REPORT = 'cohort_milestone_report';
export const MILESTONE_REVIEW = 'cohort_milestone_review';
export const STAGE_CHANGE = 'cohort_stage_change';
export const REMINDER = 'cohort_reminder';
export const SESSION = 'cohort_session';
export const SESSION_BOOKING = 'cohort_session_booking';
export const ATTENDANCE = 'cohort_attendance';
export const FORM = 'cohort_form';
export const ANNOUNCEMENT = 'cohort_announcement';
export const BOOKMARK = 'cohort_bookmark';
export const EMAIL_SETTING = 'cohort_email_setting';
export const DEMO_SLOT = 'cohort_demo_slot';
export const DEMO_GUEST = 'cohort_demo_guest';
export const PITCH_FEEDBACK = 'cohort_pitch_feedback';

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
	schema: {
		description: 'A programme of the innovation hub, e.g. an incubation or acceleration track.',
		required: ['name', 'status'],
		properties: {
			name: text('Fintech Acceleration 2027', 'The name of the programme.', 255, 1),
			description: text('A six-month programme for fintech startups.', 'What the programme offers.', 4000),
			status: text('open', 'draft, open or closed.', 20, 1),
			starts_on: text('2027-01-15', 'First day (YYYY-MM-DD).', 10),
			ends_on: text('2027-07-15', 'Last day (YYYY-MM-DD).', 10),
			stages: text(
				'[{"key":"in_programme","gate":{"company":true}},{"key":"graduated","gate":{"milestones":"all"}}]',
				'The stages after onboarding, in order, each with its gate (JSON); empty for the default. The last is graduated.',
				4000
			)
		}
	}
};

/** A call for applications to a programme. Public: applicants find open calls on the website. */
export const callEntity: SystemDynamicEntityDefinition = {
	entity_name: CALL,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	schema: {
		description: 'A call for applications to a programme.',
		required: ['programme_id', 'title', 'status'],
		properties: {
			programme_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_programme this call is for.', 36, 1),
			title: text('Cohort 1 - spring 2027', 'The title applicants see.', 255, 1),
			description: text('Applications are open to fintech startups.', 'What the call is looking for.', 4000),
			status: text('open', 'draft, open or closed.', 20, 1),
			opens_at: text('2026-11-01', 'When applications open (YYYY-MM-DD).', 10),
			closes_at: text('2026-12-15', 'When applications close (YYYY-MM-DD).', 10),
			eligibility_residency: text('resident_or_incorporated', 'Who is eligible: resident_or_incorporated (the default), resident, incorporated or none.', 30),
			eligibility_min_team_size: { type: 'integer', example: 2, description: 'The smallest eligible team; none for any size.' },
			eligibility_stages: text('mvp,early_revenue', 'The eligible startup stages, comma separated (idea, mvp, early_revenue, growth); empty for any.', 100)
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
			submitted_at: text('2026-11-20T10:00:00Z', 'When the application was submitted (ISO 8601, UTC).', 30),
			customer_id: text('7uy8a7e4-6d02-40e3-a129-0b2bf89de9f0', "The applicant's Customer in the space: the legal person, and where emails go.", 36),
			form_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', "The call's cohort_form whose extra questions this application answered, in that form's dynamic entity.", 36)
		}
	}
};

/**
 * A screening decision on an application. Append-only: staff create decisions and nobody is given the update or
 * delete Roles, so the history stays as it was written. Cohort itself, as a Platform App with the Get Scope,
 * reads the decisions on an applicant's own application to show them the outcome; applicants hold no Role.
 */
export const screeningDecisionEntity: SystemDynamicEntityDefinition = {
	entity_name: SCREENING_DECISION,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description:
			'A decision on an application, written by staff: at screening or at evaluation (approval, after ranking). The latest one, of any stage, is the current outcome.',
		required: ['application_id', 'decision', 'decided_at'],
		properties: {
			application_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_application decided on.', 36, 1),
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_call the application is for.', 36),
			decision: text('shortlisted', 'Screening: shortlisted, rejected or needs_info. Evaluation: accepted, waitlisted or rejected.', 20, 1),
			stage: text('evaluation', 'screening or evaluation (none means screening).', 20),
			reason: text('Strong team, clear market.', 'Why, for staff only.', 4000),
			message_to_applicant: text('Please add your team size.', 'What the applicant is told.', 4000),
			decided_by_username: text('felixsmith', 'Who decided, as shown to staff.', 255),
			decided_at: text('2026-11-25T09:00:00Z', 'When the decision was made (ISO 8601, UTC).', 30, 1)
		}
	}
};

/**
 * A conversation with Opey, recorded by Cohort as the User after each message: the audit log of questions and
 * answers. The Portal's definition (shared, so the two only grow together) under Cohort's name, in Cohort's space.
 * Personal: each User sees only their own. Community: auditors holding CanGetDynamicEntityRecord_cohort_opey_conversation
 * at the space read every conversation, read only. Anonymous visitors' chats are not recorded.
 */
export const opeyConversationEntity: SystemDynamicEntityDefinition = {
	...(PORTAL_OPEY_CONVERSATION_ENTITY as SystemDynamicEntityDefinition),
	entity_name: OPEY_CONVERSATION,
	has_community_access: true,
	schema: {
		...PORTAL_OPEY_CONVERSATION_ENTITY.schema,
		description:
			'A conversation between a User and Opey in Cohort, written by Cohort as the User after each message completes. Personal: each User sees only their own conversations; auditors with the Get Role read all of them.'
	}
};

const integer = (example: number, description: string) => ({ type: 'integer', example, description });

/** A criterion of a call's scoring rubric. Public, so applicants see how they are judged; staff create them. */
export const rubricCriterionEntity: SystemDynamicEntityDefinition = {
	entity_name: RUBRIC_CRITERION,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	schema: {
		description: "A criterion of a call's scoring rubric: reviewers score each submitted application on it.",
		required: ['call_id', 'name', 'max_score'],
		properties: {
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_call this criterion belongs to.', 36, 1),
			name: text('Team', 'What is scored.', 255, 1),
			description: text('Does the team have the skills to deliver?', 'Guidance for reviewers.', 2000),
			max_score: integer(5, 'The highest score (the lowest is 0).'),
			weight: integer(1, 'How much it counts relative to the other criteria; 1 when not set.'),
			position: integer(1, 'Its place in the rubric.')
		}
	}
};

/**
 * Someone who offers to review applications, with their expertise. Personal: each person creates their own, with no
 * Role. Community: staff holding the Get Role read the whole pool, to assign reviewers from it.
 */
export const reviewerEntity: SystemDynamicEntityDefinition = {
	entity_name: REVIEWER,
	has_personal_entity: true,
	personal_requires_role: false,
	has_public_access: false,
	has_community_access: true,
	schema: {
		description: 'A person who offers to review applications. Staff assign reviewers from these.',
		required: ['user_id', 'display_name'],
		properties: {
			user_id: text('9ca9a7e4-6d02-40e3-a129-0b2bf89de9b1', 'The User who offers to review.', 255, 1),
			display_name: text('Felix Smith', 'The name staff see.', 255, 1),
			expertise: text('Payments, regulation', 'What they know about.', 1000),
			status: text('available', 'available or unavailable.', 20)
		}
	}
};

/**
 * Staff accepting or declining an offer to review. Append-only, like screening decisions: the latest one is the
 * reviewer's standing, and only an accepted reviewer is assigned applications and sees their assignments. It is not a
 * field on the offer, which is the reviewer's own record. Cohort itself, as a Platform App with the Get Scope,
 * reads a reviewer's standing; reviewers hold no Role.
 */
export const reviewerDecisionEntity: SystemDynamicEntityDefinition = {
	entity_name: REVIEWER_DECISION,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description: 'Staff accepting or declining an offer to review. The latest one is the current standing.',
		required: ['reviewer_user_id', 'decision', 'decided_at'],
		properties: {
			reviewer_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_reviewer offer decided on.', 36),
			reviewer_user_id: text('9ca9a7e4-6d02-40e3-a129-0b2bf89de9b1', 'The User who offered to review.', 255, 1),
			decision: text('accepted', 'accepted or declined.', 20, 1),
			reason: text('Ten years in payments.', 'Why, for staff only.', 4000),
			decided_by_username: text('janedoe', 'Who decided, as shown to staff.', 255),
			decided_at: text('2026-11-25T09:00:00Z', 'When the decision was made (ISO 8601, UTC).', 30, 1)
		}
	}
};

/** A reviewer assigned to an application. Staff create assignments; they are never edited. */
export const reviewAssignmentEntity: SystemDynamicEntityDefinition = {
	entity_name: REVIEW_ASSIGNMENT,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description: 'A reviewer assigned to review an application.',
		required: ['application_id', 'call_id', 'reviewer_user_id', 'assigned_at'],
		properties: {
			application_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_application to review.', 36, 1),
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'Its cohort_call.', 36, 1),
			reviewer_user_id: text('9ca9a7e4-6d02-40e3-a129-0b2bf89de9b1', 'The reviewer.', 255, 1),
			reviewer_name: text('Felix Smith', "The reviewer's display name.", 255),
			assigned_by_username: text('janedoe', 'Who assigned it.', 255),
			assigned_at: text('2026-11-25T09:00:00Z', 'When (ISO 8601, UTC).', 30, 1),
			due_on: text('2026-12-05', 'When the review is due (YYYY-MM-DD).', 10)
		}
	}
};

/**
 * A reviewer's review of an application. Personal: the reviewer writes their own, with no Role. It first records
 * whether they have a conflict of interest; with one, there are no scores and staff reassign the application.
 * Community: staff holding the Get Role read every review, for ranking.
 */
export const reviewEntity: SystemDynamicEntityDefinition = {
	entity_name: REVIEW,
	has_personal_entity: true,
	personal_requires_role: false,
	has_public_access: false,
	has_community_access: true,
	schema: {
		description: 'A review of an application, written by its reviewer: a conflict-of-interest declaration, and scores.',
		required: ['assignment_id', 'application_id', 'conflict_of_interest', 'submitted_at'],
		properties: {
			assignment_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_review_assignment.', 36, 1),
			application_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_application reviewed.', 36, 1),
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'Its cohort_call.', 36),
			conflict_of_interest: { type: 'boolean', example: false, description: 'The reviewer declared a conflict of interest.' },
			conflict_note: text('I advise this company.', 'The conflict, for staff.', 1000),
			scores_json: text('{"criterion-id":4}', 'The score for each cohort_rubric_criterion, by its id.', 4000),
			total_score: integer(80, 'The weighted score out of 100.'),
			comments: text('Strong team; unclear market.', "The reviewer's comments, for staff.", 4000),
			submitted_at: text('2026-11-28T10:00:00Z', 'When it was submitted (ISO 8601, UTC).', 30, 1)
		}
	}
};

/**
 * A startup's place in a programme, from its acceptance. Cohort keeps these as itself (as a Platform App, with the
 * Create, Get and Update Scopes): it creates one when an application is accepted at evaluation, and fills in
 * customer_id when the startup registers its company (a CORPORATE Customer, its applicant linked to it). The startup
 * sees its own through Cohort; staff read all with the Get Role. Milestones, sessions and attendance refer to it.
 */
export const participantEntity: SystemDynamicEntityDefinition = {
	entity_name: PARTICIPANT,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description: "A startup's place in a programme: created when its application is accepted, then onboarded.",
		required: ['programme_id', 'application_id', 'user_id', 'stage', 'status', 'joined_at'],
		properties: {
			programme_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_programme.', 36, 1),
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_call it applied to.', 36),
			application_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The accepted cohort_application.', 36, 1),
			user_id: text('9ca9a7e4-6d02-40e3-a129-0b2bf89de9b1', 'The applicant: the User who represents the startup.', 255, 1),
			startup_name: text('Example Pay', 'The name of the startup, from its application.', 255),
			customer_id: text('7uy8a7e4-6d02-40e3-a129-0b2bf89de9f0', "The startup's CORPORATE Customer, once it has registered its company.", 36),
			stage: text('onboarded', 'Where it is in the programme: onboarded, in_programme or graduated.', 30, 1),
			status: text('active', 'active, withdrawn or graduated.', 20, 1),
			joined_at: text('2026-12-01T09:00:00Z', 'When it was accepted (ISO 8601, UTC).', 30, 1),
			accepted_by_username: text('janedoe', 'Who accepted the application.', 255),
			graduated_at: text('2027-06-30T09:00:00Z', 'When it graduated (ISO 8601, UTC).', 30),
			risk: text('watch', 'A risk flag raised by staff: none, watch or at_risk.', 20),
			risk_note: text('The founders disagree about the pivot.', 'Why staff raised the flag.', 1000),
			risk_set_by_username: text('janedoe', 'Who last set the flag.', 255),
			risk_set_at: text('2027-02-01T09:00:00Z', 'When the flag was last set (ISO 8601, UTC).', 30)
		}
	}
};

/** A checkpoint a programme's startups must reach. Public, like a rubric: startups see what is expected of them. */
export const milestoneEntity: SystemDynamicEntityDefinition = {
	entity_name: MILESTONE,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	schema: {
		description: "A milestone of a programme: what its startups must reach, and by when.",
		required: ['programme_id', 'title'],
		properties: {
			programme_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_programme.', 36, 1),
			title: text('MVP built', 'What the startup must reach.', 255, 1),
			description: text('A working version that a pilot customer can use.', 'What counts as reaching it, and what evidence to give.', 4000),
			due_on: text('2027-02-15', 'When it is due (YYYY-MM-DD).', 10),
			position: integer(1, 'Its place in the list.')
		}
	}
};

/**
 * A startup's report on a milestone: a note and evidence files (personal files attached to the report). Personal:
 * the startup's applicant writes their own, with no Role. Community: staff holding the Get Role read every report.
 */
export const milestoneReportEntity: SystemDynamicEntityDefinition = {
	entity_name: MILESTONE_REPORT,
	has_personal_entity: true,
	personal_requires_role: false,
	has_public_access: false,
	has_community_access: true,
	schema: {
		description: "A startup's report on reaching a milestone, with evidence files attached.",
		required: ['milestone_id', 'participant_id', 'submitted_at'],
		properties: {
			milestone_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_milestone.', 36, 1),
			participant_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_participant reporting.', 36, 1),
			programme_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_programme.', 36),
			note: text('Our MVP is live with two pilot merchants.', 'What the startup did, for staff.', 4000),
			submitted_at: text('2027-02-10T09:00:00Z', 'When it was submitted (ISO 8601, UTC).', 30, 1)
		}
	}
};

/**
 * Staff accepting a milestone report, or returning it with a message. Append-only: the latest review of a report is
 * its outcome. Staff write and read these with their own Roles; Cohort reads them with its Get Scope only to show a
 * startup the outcome of its own reports.
 */
export const milestoneReviewEntity: SystemDynamicEntityDefinition = {
	entity_name: MILESTONE_REVIEW,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description: 'Staff accepting a milestone report, or returning it with a message for the startup.',
		required: ['report_id', 'milestone_id', 'participant_id', 'decision', 'decided_at'],
		properties: {
			report_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_milestone_report reviewed.', 36, 1),
			milestone_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_milestone.', 36, 1),
			participant_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_participant.', 36, 1),
			decision: text('accepted', 'accepted or returned.', 20, 1),
			message_to_startup: text('Please add the pilot contract.', 'What the startup is told.', 4000),
			decided_by_username: text('janedoe', 'Who reviewed it.', 255),
			decided_at: text('2027-02-12T09:00:00Z', 'When (ISO 8601, UTC).', 30, 1)
		}
	}
};

/**
 * A startup moving from one stage of its programme to the next, by staff. Append-only: the history of each
 * participant's stages, with who and when; the participant itself holds the current stage.
 */
export const stageChangeEntity: SystemDynamicEntityDefinition = {
	entity_name: STAGE_CHANGE,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description: "A startup moving to the next stage of its programme, recorded by staff.",
		required: ['participant_id', 'from_stage', 'to_stage', 'changed_at'],
		properties: {
			participant_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_participant.', 36, 1),
			programme_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_programme.', 36),
			from_stage: text('in_programme', 'The stage it left.', 30, 1),
			to_stage: text('graduated', 'The stage it moved to.', 30, 1),
			note: text('All milestones accepted.', 'Why, for staff.', 4000),
			changed_by_username: text('janedoe', 'Who moved it.', 255),
			changed_at: text('2027-06-30T09:00:00Z', 'When (ISO 8601, UTC).', 30, 1)
		}
	}
};

/**
 * A reminder Cohort emailed, by itself: a milestone due soon or overdue, or a call closing on a draft application.
 * Written once per reminder key, so nothing is sent twice; the log staff read with the Get Role. Cohort writes and
 * reads these with its Scopes, as no staff member sends them.
 */
export const reminderEntity: SystemDynamicEntityDefinition = {
	entity_name: REMINDER,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description: 'A reminder Cohort emailed on its own, recorded once so it is never sent twice.',
		required: ['reminder_key', 'kind', 'sent_at'],
		properties: {
			reminder_key: text('milestone_due:participant-id:milestone-id', 'What was reminded, once: kind and records.', 255, 1),
			kind: text('milestone_due', 'milestone_due, milestone_overdue or call_closing.', 30, 1),
			about: text('MVP built', 'What it was about, as staff see it.', 500),
			startup_name: text('Example Pay', 'The startup it went to.', 255),
			customer_id: text('7uy8a7e4-6d02-40e3-a129-0b2bf89de9f0', 'The Customer it was emailed to.', 36),
			sent_at: text('2027-02-08T08:00:00Z', 'When (ISO 8601, UTC).', 30, 1)
		}
	}
};

/**
 * A session of a programme: a mentoring slot, a workshop or a demo day. Staff create these with their Roles; a
 * startup sees its own programme's through Cohort (its Get Scope, narrowed to the programmes it takes part in).
 */
export const sessionEntity: SystemDynamicEntityDefinition = {
	entity_name: SESSION,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description: 'A session of a programme: mentoring, a workshop, office hours or a demo day, with its time, place and seats.',
		required: ['programme_id', 'title', 'kind', 'starts_at'],
		properties: {
			programme_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_programme.', 36, 1),
			title: text('Go-to-market clinic', 'What the session is.', 255, 1),
			kind: text('mentoring', 'mentoring, workshop, office_hours or demo_day.', 20, 1),
			starts_at: text('2027-03-01T10:00', 'When it starts (YYYY-MM-DDTHH:MM, local time of the programme).', 20, 1),
			duration_minutes: integer(60, 'How long it lasts.'),
			location: text('Innovation Hub, room 2, or an online link', 'Where, or the link to join.', 1000),
			mentor_name: text('Felix Smith', 'Who leads it.', 255),
			capacity: integer(1, 'How many startups can book it (1 for a one-to-one slot).')
		}
	}
};

/**
 * A startup's booking of a session seat. Personal: its applicant books and cancels their own, with no Role.
 * Community: staff with the Get Role read every booking; Cohort counts the seats taken with its Get Scope.
 */
export const sessionBookingEntity: SystemDynamicEntityDefinition = {
	entity_name: SESSION_BOOKING,
	has_personal_entity: true,
	personal_requires_role: false,
	has_public_access: false,
	has_community_access: true,
	schema: {
		description: "A startup's seat at a session, booked by the startup.",
		required: ['session_id', 'participant_id', 'booked_at'],
		properties: {
			session_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_session.', 36, 1),
			participant_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_participant booking.', 36, 1),
			startup_name: text('Example Pay', 'The startup, as staff see it.', 255),
			booked_at: text('2027-02-20T09:00:00Z', 'When (ISO 8601, UTC).', 30, 1)
		}
	}
};

/** Staff recording whether a startup attended a session. Append-only: the latest for a session and startup counts. */
export const attendanceEntity: SystemDynamicEntityDefinition = {
	entity_name: ATTENDANCE,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description: 'Whether a startup attended a session, recorded by staff.',
		required: ['session_id', 'participant_id', 'attended', 'recorded_at'],
		properties: {
			session_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_session.', 36, 1),
			participant_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_participant.', 36, 1),
			attended: { type: 'boolean', example: true, description: 'The startup attended.' },
			recorded_by_username: text('janedoe', 'Who recorded it.', 255),
			recorded_at: text('2027-03-01T12:00:00Z', 'When (ISO 8601, UTC).', 30, 1)
		}
	}
};

/**
 * A form from the form builder: a call's extra application questions, or a survey of a programme's startups. Public,
 * as calls are, so applicants and startups read the questions with no Role; staff create and edit forms with their
 * Roles. Publishing makes the form its own dynamic entity (`entity_name`), one property per question, whose records
 * are the answers: personal, so each applicant or startup writes their own, and community, so staff read them all.
 */
export const formEntity: SystemDynamicEntityDefinition = {
	entity_name: FORM,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	schema: {
		description: "A form from the form builder: a call's extra application questions, or a survey of a programme's startups.",
		required: ['purpose', 'title', 'status'],
		properties: {
			purpose: text('survey', 'application (extra questions of a call) or survey (for the startups of a programme).', 20, 1),
			title: text('Mid-programme survey', 'The title in English.', 255, 1),
			title_ar: text('استبيان منتصف البرنامج', 'The title in Arabic.', 255),
			description: text('Tell us how the programme is going.', 'What it is for, in English.', 4000),
			description_ar: text('أخبرنا كيف يسير البرنامج.', 'What it is for, in Arabic.', 4000),
			call_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'For an application form: the cohort_call.', 36),
			programme_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'For a survey: the cohort_programme.', 36),
			status: text('draft', 'draft, published or closed.', 20, 1),
			version: integer(1, 'Its version: a bigger change than adding questions is a new version, a new form.'),
			questions: text('[{"key":"funding_raised","kind":"number","label":"Funding raised","label_ar":"التمويل","required":true}]', 'The questions as JSON: key, kind, labels and help in English and Arabic, options, required, published, hidden.', 20000),
			entity_name: text('cohort_form_6fb175831e49', 'The dynamic entity it was published as, holding the answers.', 64),
			dynamic_entity_id: text('9a2b5e3c-1d4f-4e6a-8b7c-0d1e2f3a4b5c', "That dynamic entity's definition id, to add questions to it.", 64),
			published_at: text('2027-03-01T09:00:00Z', 'When it was first published (ISO 8601, UTC).', 30),
			published_by_username: text('janedoe', 'Who published it.', 255),
			replaces_form_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The earlier version of this form, closed when this one is published.', 36)
		}
	}
};

/**
 * News from the programme office: call dates, demo day, changes to a session. Public, so anyone reads them without
 * a Role or Scope; staff publish and remove them with their own Roles. programme_id narrows one to a programme's
 * startups' page, but it is still public.
 */
export const announcementEntity: SystemDynamicEntityDefinition = {
	entity_name: ANNOUNCEMENT,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	schema: {
		description: 'An announcement from the programme office, public: news, call dates, demo day, changes to sessions.',
		required: ['title', 'published_at'],
		properties: {
			title: text('Demo day on 30 June', 'The headline, in English.', 255, 1),
			title_ar: text('يوم العرض في 30 يونيو', 'The headline, in Arabic.', 255),
			body: text('Startups pitch to investors and banks from 10:00.', 'The announcement, in English.', 4000),
			body_ar: text('تعرض الشركات الناشئة على المستثمرين والبنوك من الساعة 10:00.', 'The announcement, in Arabic.', 4000),
			programme_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', "The cohort_programme it is about, if any; empty for everyone.", 36),
			published_at: text('2027-06-01T09:00:00Z', 'When it was published (ISO 8601, UTC).', 30, 1),
			published_by_username: text('janedoe', 'Who published it.', 255)
		}
	}
};

/** Something a User saved to come back to: a call, or (for staff) an application. Personal: each User's own. */
export const bookmarkEntity: SystemDynamicEntityDefinition = {
	entity_name: BOOKMARK,
	has_personal_entity: true,
	personal_requires_role: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description: "Something a User saved to come back to, on their Saved page: their own list.",
		required: ['kind', 'target_id', 'path'],
		properties: {
			kind: text('call', 'call or application.', 20, 1),
			target_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The id of the record saved.', 36, 1),
			label: text('Cohort 1 - spring 2027', 'What it was called when saved.', 255),
			path: text('/calls/6fb17583-1e49-4435-bb74-a14fe0996723', "The Cohort page it was saved from.", 255, 1),
			saved_at: text('2027-01-10T09:00:00Z', 'When it was saved (ISO 8601, UTC).', 30)
		}
	}
};

/**
 * Which emails Cohort sends on its own, and when: one record, set by staff with their Roles. Public, as it holds only
 * switches and days, so Cohort's reminder timer reads it without a Scope.
 */
export const emailSettingEntity: SystemDynamicEntityDefinition = {
	entity_name: EMAIL_SETTING,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	schema: {
		description: 'Which emails Cohort sends on its own, and when. One record; without it every email is sent.',
		required: ['updated_at'],
		properties: {
			submitted: { type: 'boolean', example: true, description: 'Email the applicant when they submit an application.' },
			decision: { type: 'boolean', example: true, description: 'Email the applicant the outcome of a decision.' },
			milestone_due: { type: 'boolean', example: true, description: 'Remind a startup of a milestone coming due.' },
			milestone_overdue: { type: 'boolean', example: true, description: 'Remind a startup of an overdue milestone.' },
			call_closing: { type: 'boolean', example: true, description: 'Remind an applicant of an unsubmitted draft before its call closes.' },
			due_soon_days: { type: 'integer', example: 7, description: 'Days before a milestone is due to remind.' },
			closing_soon_days: { type: 'integer', example: 3, description: 'Days before a call closes to remind.' },
			updated_by_username: text('janedoe', 'Who last changed the settings.', 255),
			updated_at: text('2027-01-10T09:00:00Z', 'When (ISO 8601, UTC).', 30, 1)
		}
	}
};

/**
 * A startup's pitch slot on a demo day: the running order. Public, like the demo day page that shows it (only names and
 * times); staff create and remove slots with their Roles.
 */
export const demoSlotEntity: SystemDynamicEntityDefinition = {
	entity_name: DEMO_SLOT,
	has_personal_entity: false,
	has_public_access: true,
	has_community_access: false,
	schema: {
		description: "A startup's pitch slot on a demo day session: its place in the running order and time.",
		required: ['session_id', 'participant_id', 'position'],
		properties: {
			session_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The demo day cohort_session.', 36, 1),
			participant_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_participant pitching.', 36, 1),
			startup_name: text('Example Pay', 'The startup, as shown on the agenda.', 255),
			position: { type: 'integer', example: 1, description: 'Its place in the running order, from 1.' },
			starts_at: text('10:15', 'When it pitches (HH:MM, local time).', 5),
			pitch_title: text('Payments for every merchant', 'The title of the pitch.', 255)
		}
	}
};

/** Someone invited to a demo day: an investor, a bank, a regulator. Staff only. */
export const demoGuestEntity: SystemDynamicEntityDefinition = {
	entity_name: DEMO_GUEST,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description: 'A guest invited to a demo day session: investors, banks, regulators. Recorded by staff.',
		required: ['session_id', 'name', 'status'],
		properties: {
			session_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The demo day cohort_session.', 36, 1),
			name: text('Jane Investor', 'Who is invited.', 255, 1),
			organisation: text('Example Ventures', 'Their organisation.', 255),
			email: text('jane@example.com', 'Their email address.', 255),
			status: text('invited', 'invited, confirmed or declined.', 20, 1),
			invited_by_username: text('janedoe', 'Who recorded the invitation.', 255),
			invited_at: text('2027-06-01T09:00:00Z', 'When (ISO 8601, UTC).', 30)
		}
	}
};

/**
 * Feedback on a startup's pitch, given by staff with their Roles (after a rehearsal or the demo day itself); the startup
 * sees its own through Cohort, narrowed to its participations.
 */
export const pitchFeedbackEntity: SystemDynamicEntityDefinition = {
	entity_name: PITCH_FEEDBACK,
	has_personal_entity: false,
	has_public_access: false,
	has_community_access: false,
	schema: {
		description: "Feedback on a startup's demo day pitch or rehearsal, for the startup.",
		required: ['session_id', 'participant_id', 'feedback'],
		properties: {
			session_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_session the pitch was at.', 36, 1),
			participant_id: text('6fb17583-1e49-4435-bb74-a14fe0996723', 'The cohort_participant that pitched.', 36, 1),
			feedback: text('Lead with the merchant numbers; the deck runs long.', 'What the startup should know.', 4000, 1),
			given_by_username: text('janedoe', 'Who gave it.', 255),
			given_at: text('2027-06-30T12:00:00Z', 'When (ISO 8601, UTC).', 30)
		}
	}
};

export const COHORT_ENTITIES: SystemDynamicEntityDefinition[] = [
	programmeEntity,
	callEntity,
	applicationEntity,
	screeningDecisionEntity,
	opeyConversationEntity,
	rubricCriterionEntity,
	reviewerEntity,
	reviewerDecisionEntity,
	reviewAssignmentEntity,
	reviewEntity,
	participantEntity,
	milestoneEntity,
	milestoneReportEntity,
	milestoneReviewEntity,
	stageChangeEntity,
	reminderEntity,
	sessionEntity,
	sessionBookingEntity,
	attendanceEntity,
	formEntity,
	announcementEntity,
	bookmarkEntity,
	emailSettingEntity,
	demoSlotEntity,
	demoGuestEntity,
	pitchFeedbackEntity
];
