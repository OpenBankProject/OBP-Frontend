#!/usr/bin/env node
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
 * Seeds Cohort's space with demo data from a JSON file, for demos and screenshots: programmes (with their stages),
 * milestones, sessions, calls (with eligibility rules and rubrics), organisations, announcements, discussions (chat
 * rooms and their messages), retention policies (switched off), and startups with their applications, decisions,
 * reviews, participation, milestone reports and reviews, bookings and attendance.
 *
 * It logs in to OBP-API with DirectLogin as a staff user (who holds Cohort's staff Roles) and as a startup user (no
 * Roles); each record is written by whoever writes it in Cohort. Records that already exist (matched by name or title)
 * are skipped, so it can be run again. It prints counts and errors only, never credentials or tokens.
 *
 *   node apps/cohort/scripts/seed-demo-data.mjs <data.json> <credentials.env>
 *
 * The credentials file holds OBP_BASE_URL, OBP_CONSUMER_KEY, COHORT_SPACE (default cohort), STAFF_USERNAME,
 * STAFF_PASSWORD, STARTUP_USERNAME and STARTUP_PASSWORD. Dates in the data are days relative to today.
 *
 * With SUPERUSER_USERNAME and SUPERUSER_PASSWORD set too (a user who may grant Roles, such as one in OBP-API's
 * super_admin_user_ids), it first grants the staff user each staff Role it does not hold yet, at the space Cohort uses
 * it: STAFF_ROLES in src/lib/server/staffAccess.ts, read from the source so the two lists cannot drift apart.
 * COHORT_FORMS_SPACE (default <COHORT_SPACE>-forms) is where the definition Roles go. A test user whose email is not
 * validated yet is validated by the superuser (CanValidateUser) before logging in.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [dataPath, envPath] = process.argv.slice(2);
if (!dataPath || !envPath) {
	console.error('Usage: node apps/cohort/scripts/seed-demo-data.mjs <data.json> <credentials.env>');
	process.exit(2);
}

/** KEY=VALUE lines; # comments and blank lines ignored; surrounding quotes removed. */
function readEnv(path) {
	const env = {};
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
		if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
	}
	return env;
}

const env = { ...readEnv(envPath) };
for (const key of ['OBP_BASE_URL', 'OBP_CONSUMER_KEY', 'STAFF_USERNAME', 'STAFF_PASSWORD', 'STARTUP_USERNAME', 'STARTUP_PASSWORD']) {
	if (!env[key]) {
		console.error(`${key} is not set in ${envPath}`);
		process.exit(2);
	}
}
const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const base = env.OBP_BASE_URL.replace(/\/+$/, '');
const space = encodeURIComponent(env.COHORT_SPACE || 'cohort');

// ---- OBP-API ----

async function obp(method, path, token, body) {
	const res = await fetch(base + path, {
		method,
		headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `DirectLogin token="${token}"` } : {}) },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const text = await res.text();
	let json = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		// Not JSON: the text goes into the error below.
	}
	if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${json?.message ?? text.slice(0, 200)}`);
	return json;
}

async function login(username, password) {
	const res = await fetch(`${base}/my/logins/direct`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			DirectLogin: `username="${username}",password="${password}",consumer_key="${env.OBP_CONSUMER_KEY}"`
		}
	});
	const json = await res.json().catch(() => null);
	if (!res.ok || !json?.token) throw new Error(`DirectLogin as ${username} failed: ${res.status} ${json?.message ?? ''}`);
	const me = await obp('GET', '/obp/v5.1.0/users/current', json.token);
	return {
		token: json.token,
		user_id: String(me?.user_id ?? ''),
		username: String(me?.username ?? username),
		entitlements: me?.entitlements?.list ?? []
	};
}

/**
 * Cohort's staff Roles with the bank id each is held at, read from staffAccess.ts and the dynamic entity names in
 * entities/definitions.ts. The system Roles are held at bank id "".
 */
function staffRoles() {
	const server = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/server');
	const names = {};
	for (const [, constant, name] of readFileSync(join(server, 'entities/definitions.ts'), 'utf8').matchAll(/^export const ([A-Z_]+) = '([^']+)';/gm)) names[constant] = name;
	const source = readFileSync(join(server, 'staffAccess.ts'), 'utf8');
	const list = source.slice(source.indexOf('export const STAFF_ROLES'), source.indexOf('];', source.indexOf('export const STAFF_ROLES')));
	const cohort = env.COHORT_SPACE || 'cohort';
	const spaces = { '': cohort, forms: env.COHORT_FORMS_SPACE || `${cohort}-forms`, system: '' };
	const roles = [];
	for (const [, quoted, prefix, constant, where] of list.matchAll(/role_name: (?:'([^']+)'|`([A-Za-z]+)_\$\{([A-Z_]+)\}`)[^}]*?(?:space: '(forms|system)')?\s*\}/g)) {
		const role_name = quoted ?? `${prefix}_${names[constant]}`;
		if (!quoted && !names[constant]) throw new Error(`staffAccess.ts names ${constant}, which definitions.ts does not define`);
		const bank_id = spaces[where ?? ''];
		if (!roles.some((r) => r.role_name === role_name && r.bank_id === bank_id)) roles.push({ role_name, bank_id });
	}
	if (roles.length === 0) throw new Error('No staff Roles found in staffAccess.ts');
	return roles;
}

const recordsPath = (entity, access = '', id) => `/obp/v7.0.0/banks/${space}/dynamic-entities/${access ? `${access}/` : ''}${entity}${id ? `/${encodeURIComponent(id)}` : ''}`;
const idOf = (entity, r) => String(r?.[`${entity}_id`] ?? '');

async function list(entity, access, token) {
	const json = await obp('GET', recordsPath(entity, access), token);
	return (json?.[`${entity}_list`] ?? []).map((item) => item?.[entity]).filter(Boolean);
}

const counts = {};
const errors = [];
const count = (what, created) => {
	counts[what] ??= { created: 0, existing: 0 };
	counts[what][created ? 'created' : 'existing']++;
};

/** Only the fields that have a value: OBP-API refuses empty strings for some types. */
const clean = (record) => Object.fromEntries(Object.entries(record).filter(([, v]) => v !== '' && v !== undefined && v !== null));

async function create(entity, access, record, token, what = entity) {
	const json = await obp('POST', recordsPath(entity, access), token, clean(record));
	count(what, true);
	return json?.[entity] ?? {};
}

/** The record matching `match` in `existing`, or a new one; the list is kept up to date. */
async function ensure(existing, match, entity, access, record, token, what = entity) {
	const found = existing.find(match);
	if (found) {
		count(what, false);
		return found;
	}
	const created = await create(entity, access, record, token, what);
	existing.push(created);
	return created;
}

/** Runs one step; a failure is recorded and the rest goes on. */
async function step(label, run) {
	try {
		return await run();
	} catch (err) {
		errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
		return null;
	}
}

// ---- Dates, relative to today ----

const DAY = 86_400_000;
const day = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const ago = (days) => new Date(Date.now() - days * DAY).toISOString().replace(/\.\d{3}Z$/, 'Z');
const localAt = (offset, time = '10:00') => `${day(offset)}T${time}`;

// ---- Cohort's rules, as the app applies them ----

const STAGES = ['idea', 'mvp', 'early_revenue', 'growth'];

function eligibility(app, call) {
	const resident = app.local_resident === true;
	const incorporated = app.incorporated_locally === true;
	const residency = call.eligibility_residency || 'resident_or_incorporated';
	const local = { resident_or_incorporated: resident || incorporated, resident, incorporated, none: true }[residency] ?? true;
	const min = Number(call.eligibility_min_team_size);
	const team = !(Number.isInteger(min) && min > 0) || Number(app.team_size) >= min;
	const stages = String(call.eligibility_stages ?? '').split(',').map((s) => s.trim()).filter((s) => STAGES.includes(s));
	const stage = stages.length === 0 || stages.includes(String(app.stage ?? ''));
	return local && team && stage ? 'eligible' : 'needs_review';
}

function totalScore(criteria, scores) {
	let got = 0;
	let possible = 0;
	for (const c of criteria) {
		const s = scores[c.id];
		if (typeof s !== 'number') return null;
		got += (s / c.max_score) * c.weight;
		possible += c.weight;
	}
	return possible ? Math.round((100 * got) / possible) : null;
}

// ---- Seeding ----

const superuser = env.SUPERUSER_USERNAME && env.SUPERUSER_PASSWORD ? await login(env.SUPERUSER_USERNAME, env.SUPERUSER_PASSWORD) : null;

/** Logs in; a test user whose email is not validated yet is validated by the superuser (CanValidateUser) first. */
async function loginValidated(username, password) {
	try {
		return await login(username, password);
	} catch (err) {
		if (!superuser || !String(err?.message).includes('OBP-20073')) throw err;
		const found = await obp('GET', `/obp/v7.0.0/users?username=${encodeURIComponent(username)}`, superuser.token);
		const users = (found?.users ?? []).filter((u) => u?.username === username && u?.user_id);
		if (users.length !== 1) throw new Error(`Expected one user with username ${username}, found ${users.length}`);
		await obp('PUT', `/obp/v5.1.0/management/users/${encodeURIComponent(users[0].user_id)}`, superuser.token);
		console.log(`Validated the email of ${username}`);
		return login(username, password);
	}
}

const staff = await loginValidated(env.STAFF_USERNAME, env.STAFF_PASSWORD);
const startup = await loginValidated(env.STARTUP_USERNAME, env.STARTUP_PASSWORD);

if (superuser) {
	const held = new Set(staff.entitlements.map((e) => `${e.role_name}@${e.bank_id ?? ''}`));
	let granted = 0;
	const roles = staffRoles();
	for (const role of roles) {
		if (held.has(`${role.role_name}@${role.bank_id}`)) continue;
		const done = await step(`grant ${role.role_name}${role.bank_id ? ` at ${role.bank_id}` : ''}`, () =>
			obp('POST', `/obp/v5.1.0/users/${encodeURIComponent(staff.user_id)}/entitlements`, superuser.token, role)
		);
		if (done) granted++;
	}
	console.log(`Staff Roles: ${roles.length} needed, ${granted} granted now`);
}
const owners = { staff, startup };

const programmeIds = {};
const milestoneIds = {};
const milestoneDue = {};
const sessionIds = {};
const sessionStart = {};
const calls = {};

const programmes = await list('cohort_programme', 'public');
const milestones = await list('cohort_milestone', 'public');
const sessions = await list('cohort_session', '', staff.token).catch(() => []);
for (const p of data.programmes ?? []) {
	const programme = await step(`programme ${p.name}`, () =>
		ensure(programmes, (r) => r.name === p.name, 'cohort_programme', '', {
			name: p.name,
			description: p.description,
			status: p.status ?? 'open',
			starts_on: p.starts_in_days !== undefined ? day(p.starts_in_days) : '',
			ends_on: p.ends_in_days !== undefined ? day(p.ends_in_days) : '',
			stages: p.stages ? JSON.stringify(p.stages) : ''
		}, staff.token, 'programmes')
	);
	if (!programme) continue;
	const programmeId = idOf('cohort_programme', programme);
	programmeIds[p.key] = programmeId;
	for (const m of p.milestones ?? []) {
		milestoneDue[m.key] = m.due_in_days ?? 0;
		const milestone = await step(`milestone ${m.title}`, () =>
			ensure(milestones, (r) => r.programme_id === programmeId && r.title === m.title, 'cohort_milestone', '', {
				programme_id: programmeId,
				title: m.title,
				description: m.description,
				due_on: m.due_in_days !== undefined ? day(m.due_in_days) : '',
				position: m.position
			}, staff.token, 'milestones')
		);
		if (milestone) milestoneIds[m.key] = idOf('cohort_milestone', milestone);
	}
	for (const s of p.sessions ?? []) {
		sessionStart[s.key] = s.starts_in_days ?? 0;
		const session = await step(`session ${s.title}`, () =>
			ensure(sessions, (r) => r.programme_id === programmeId && r.title === s.title, 'cohort_session', '', {
				programme_id: programmeId,
				title: s.title,
				kind: s.kind,
				starts_at: localAt(s.starts_in_days ?? 0, s.time),
				duration_minutes: s.duration_minutes,
				location: s.location,
				mentor_name: s.mentor_name,
				capacity: s.capacity
			}, staff.token, 'sessions')
		);
		if (session) sessionIds[s.key] = idOf('cohort_session', session);
	}
}

const callRecords = await list('cohort_call', 'public');
const criteria = await list('cohort_rubric_criterion', 'public');
for (const c of data.calls ?? []) {
	const record = {
		programme_id: programmeIds[c.programme],
		title: c.title,
		description: c.description,
		status: c.status ?? 'open',
		opens_at: c.opens_in_days !== undefined ? day(c.opens_in_days) : '',
		closes_at: c.closes_in_days !== undefined ? day(c.closes_in_days) : '',
		eligibility_residency: c.eligibility_residency,
		eligibility_min_team_size: c.eligibility_min_team_size,
		eligibility_stages: c.eligibility_stages
	};
	const call = await step(`call ${c.title}`, () => ensure(callRecords, (r) => r.title === c.title, 'cohort_call', '', record, staff.token, 'calls'));
	if (!call) continue;
	const callId = idOf('cohort_call', call);
	const rubric = [];
	for (const [i, k] of (c.rubric ?? []).entries()) {
		const criterion = await step(`rubric ${c.title} ${k.name}`, () =>
			ensure(criteria, (r) => r.call_id === callId && r.name === k.name, 'cohort_rubric_criterion', '', {
				call_id: callId,
				name: k.name,
				description: k.description,
				max_score: k.max_score,
				weight: k.weight ?? 1,
				position: i + 1
			}, staff.token, 'rubric criteria')
		);
		if (criterion) rubric.push({ id: idOf('cohort_rubric_criterion', criterion), name: k.name, max_score: Number(criterion.max_score ?? k.max_score), weight: Number(criterion.weight ?? k.weight ?? 1) });
	}
	calls[c.key] = { id: callId, record: { ...call, ...record }, rubric };
}

// Organisations: CORPORATE Customers of the space, with their kind, Arabic name and website as Customer Attributes.
const KINDS = ['bank_fi', 'university', 'regulator', 'partner'];
// Every page: OBP-API pages the list, and a page can be short before the end.
const organisations = [];
for (let offset = 0; offset < 10000; offset += 200) {
	const page = await obp('GET', `/obp/v7.0.0/banks/${space}/customers?organisation_kind=${KINDS.join(',')}&limit=200&offset=${offset}`, staff.token)
		.then((r) => r?.customers ?? [])
		.catch(() => []);
	if (page.length === 0) break;
	organisations.push(...page);
}
for (const o of data.organisations ?? []) {
	await step(`organisation ${o.name}`, async () => {
		if (organisations.some((c) => c.legal_name === o.name)) return count('organisations', false);
		const customer = await obp('POST', `/obp/v6.0.0/banks/${space}/customers`, staff.token, {
			legal_name: o.name,
			email: o.email,
			mobile_phone_number: o.mobile_phone_number,
			customer_type: 'CORPORATE',
			kyc_status: false
		});
		const customerId = encodeURIComponent(String(customer?.customer_id ?? ''));
		for (const [name, value] of Object.entries({ organisation_kind: o.kind, name_ar: o.name_ar, website: o.website })) {
			if (value) await obp('POST', `/obp/v5.1.0/banks/${space}/customers/${customerId}/attribute`, staff.token, { name, type: 'STRING', value });
		}
		organisations.push(customer);
		count('organisations', true);
	});
}

const announcements = await list('cohort_announcement', 'public');
for (const a of data.announcements ?? []) {
	await step(`announcement ${a.title}`, () =>
		ensure(announcements, (r) => r.title === a.title, 'cohort_announcement', '', {
			title: a.title,
			title_ar: a.title_ar,
			body: a.body,
			body_ar: a.body_ar,
			programme_id: a.programme ? programmeIds[a.programme] : '',
			published_at: ago(a.days_ago ?? 0),
			published_by_username: staff.username
		}, staff.token, 'announcements')
	);
}

// The staff user also reviews, so the evaluation pages have scores: an accepted reviewer.
let reviewerId = '';
if ((data.startups ?? []).some((s) => s.review)) {
	await step('reviewer', async () => {
		const mine = await list('cohort_reviewer', 'my', staff.token);
		const reviewer = await ensure(mine, () => true, 'cohort_reviewer', 'my', {
			user_id: staff.user_id,
			display_name: staff.username,
			expertise: 'Payments, lending and regulation',
			status: 'available'
		}, staff.token, 'reviewers');
		reviewerId = idOf('cohort_reviewer', reviewer);
		const standings = await list('cohort_reviewer_decision', '', staff.token);
		await ensure(standings, (r) => r.reviewer_user_id === staff.user_id && r.decision === 'accepted', 'cohort_reviewer_decision', '', {
			reviewer_id: reviewerId,
			reviewer_user_id: staff.user_id,
			decision: 'accepted',
			decided_by_username: staff.username,
			decided_at: ago(180)
		}, staff.token, 'reviewer decisions');
	});
}

const lists = {};
/** A list read once per run, by key. */
const cached = async (key, read) => (lists[key] ??= await read().catch(() => []));
const customers = {};

for (const s of data.startups ?? []) {
	await step(`startup ${s.startup_name} (${s.call})`, async () => {
		const owner = owners[s.owner === 'startup' ? 'startup' : 'staff'];
		const call = calls[s.call];
		if (!call) throw new Error(`no call ${s.call}`);
		const submitted = (s.status ?? 'submitted') === 'submitted';
		const values = {
			startup_name: s.startup_name,
			sector: s.sector,
			stage: s.stage,
			website: s.website,
			problem_statement: s.problem_statement,
			solution: s.solution,
			market_understanding: s.market_understanding,
			team_size: s.team_size,
			local_resident: s.local_resident,
			incorporated_locally: s.incorporated_locally
		};
		const apps = await cached(`apps:${s.owner}`, () => list('cohort_application', 'my', owner.token));
		const app = await ensure(apps, (r) => r.call_id === call.id && r.startup_name === s.startup_name, 'cohort_application', 'my', {
			call_id: call.id,
			status: submitted ? 'submitted' : 'draft',
			...values,
			...(submitted ? { eligibility: eligibility(values, call.record), submitted_at: ago(s.submitted_days_ago ?? 1) } : {})
		}, owner.token, 'applications');
		const appId = idOf('cohort_application', app);

		const decisions = await cached('decisions', () => list('cohort_screening_decision', '', staff.token));
		for (const [stage, d] of [['screening', s.screening], ['evaluation', s.evaluation]]) {
			if (!d) continue;
			await ensure(decisions, (r) => r.application_id === appId && r.stage === stage, 'cohort_screening_decision', '', {
				application_id: appId,
				call_id: call.id,
				decision: d.decision,
				stage,
				reason: d.reason,
				message_to_applicant: d.message,
				decided_by_username: staff.username,
				decided_at: ago(d.days_ago ?? 1)
			}, staff.token, 'decisions');
		}

		if (s.review && reviewerId && call.rubric.length) {
			const assignments = await cached('assignments', () => list('cohort_review_assignment', '', staff.token));
			const assignment = await ensure(assignments, (r) => r.application_id === appId && r.reviewer_user_id === staff.user_id, 'cohort_review_assignment', '', {
				application_id: appId,
				call_id: call.id,
				reviewer_user_id: staff.user_id,
				reviewer_name: staff.username,
				assigned_by_username: staff.username,
				assigned_at: ago((s.screening?.days_ago ?? 2) - 1)
			}, staff.token, 'review assignments');
			const assignmentId = idOf('cohort_review_assignment', assignment);
			const scores = Object.fromEntries(call.rubric.map((c) => [c.id, Number(s.review.scores?.[c.name] ?? 0)]));
			const reviews = await cached('reviews', () => list('cohort_review', 'my', staff.token));
			await ensure(reviews, (r) => r.assignment_id === assignmentId, 'cohort_review', 'my', {
				assignment_id: assignmentId,
				application_id: appId,
				call_id: call.id,
				conflict_of_interest: false,
				scores_json: JSON.stringify(scores),
				total_score: totalScore(call.rubric, scores),
				comments: s.review.comments,
				submitted_at: ago(Math.max(1, (s.evaluation?.days_ago ?? 2) + 1))
			}, staff.token, 'reviews');
		}

		const p = s.participant;
		if (!p) return;
		const participants = await cached('participants', () => list('cohort_participant', '', staff.token));
		let participant = participants.find((r) => r.application_id === appId);
		if (participant) count('participants', false);
		else {
			let customerId = '';
			if (p.company) {
				customerId = customers[p.company.legal_name] ?? '';
				if (!customerId) {
					const customer = await obp('POST', `/obp/v6.0.0/banks/${space}/customers`, staff.token, { ...p.company, customer_type: 'CORPORATE', kyc_status: false });
					customerId = customers[p.company.legal_name] = String(customer?.customer_id ?? '');
					count('companies', true);
					if (s.owner === 'startup') {
						await obp('POST', `/obp/v5.1.0/banks/${space}/user_customer_links`, staff.token, { user_id: owner.user_id, customer_id: customerId }).catch((err) =>
							errors.push(`link ${p.company.legal_name}: ${err.message}`)
						);
					}
				}
			}
			const graduated = p.stage === 'graduated';
			participant = await create('cohort_participant', '', {
				programme_id: call.record.programme_id,
				call_id: call.id,
				application_id: appId,
				user_id: owner.user_id,
				startup_name: s.startup_name,
				customer_id: customerId,
				stage: p.stage ?? 'onboarded',
				status: graduated ? 'graduated' : 'active',
				joined_at: ago(p.joined_days_ago ?? 1),
				accepted_by_username: staff.username,
				graduated_at: graduated ? ago(p.graduated_days_ago ?? 1) : '',
				risk: p.risk,
				risk_note: p.risk_note,
				risk_set_by_username: p.risk ? staff.username : '',
				risk_set_at: p.risk ? ago(3) : ''
			}, staff.token, 'participants');
			participants.push(participant);
		}
		const participantId = idOf('cohort_participant', participant);

		const reports = await cached(`reports:${s.owner}`, () => list('cohort_milestone_report', 'my', owner.token));
		const milestoneReviews = await cached('milestoneReviews', () => list('cohort_milestone_review', '', staff.token));
		for (const [key, status] of Object.entries(p.milestones ?? {})) {
			const milestoneId = milestoneIds[key];
			if (!milestoneId) continue;
			const reportDaysAgo = Math.max(1, -(milestoneDue[key] ?? 0) + 2);
			const report = await ensure(reports, (r) => r.milestone_id === milestoneId && r.participant_id === participantId, 'cohort_milestone_report', 'my', {
				milestone_id: milestoneId,
				participant_id: participantId,
				programme_id: call.record.programme_id,
				note: 'Evidence attached: summary, figures and the signed documents.',
				submitted_at: ago(reportDaysAgo)
			}, owner.token, 'milestone reports');
			if (status !== 'accepted' && status !== 'returned') continue;
			const reportId = idOf('cohort_milestone_report', report);
			await ensure(milestoneReviews, (r) => r.report_id === reportId, 'cohort_milestone_review', '', {
				report_id: reportId,
				milestone_id: milestoneId,
				participant_id: participantId,
				decision: status,
				message_to_startup: status === 'returned' ? p.returned_message ?? 'Please add the missing evidence.' : 'Well done.',
				decided_by_username: staff.username,
				decided_at: ago(Math.max(0, reportDaysAgo - 1))
			}, staff.token, 'milestone reviews');
		}

		const bookings = await cached(`bookings:${s.owner}`, () => list('cohort_session_booking', 'my', owner.token));
		const attendance = await cached('attendance', () => list('cohort_attendance', '', staff.token));
		for (const key of p.bookings ?? []) {
			const sessionId = sessionIds[key];
			if (!sessionId) continue;
			await ensure(bookings, (r) => r.session_id === sessionId && r.participant_id === participantId, 'cohort_session_booking', 'my', {
				session_id: sessionId,
				participant_id: participantId,
				startup_name: s.startup_name,
				booked_at: ago(Math.max(1, -(sessionStart[key] ?? 0) + 5))
			}, owner.token, 'bookings');
			// Attendance is recorded for sessions that have taken place.
			if ((sessionStart[key] ?? 0) >= 0) continue;
			await ensure(attendance, (r) => r.session_id === sessionId && r.participant_id === participantId, 'cohort_attendance', '', {
				session_id: sessionId,
				participant_id: participantId,
				attended: (p.attended ?? []).includes(key),
				recorded_by_username: staff.username,
				recorded_at: ago(Math.max(0, -(sessionStart[key] ?? 0) - 1))
			}, staff.token, 'attendance');
		}
	});
}

// ---- Discussions: chat rooms at Cohort's bank_id, made by staff; the startup joins with the room's joining key ----

const chat = `/obp/v6.0.0/banks/${space}/chat-rooms`;
const rooms = (await step('discussions', () => obp('GET', chat, staff.token)))?.chat_rooms ?? [];
for (const d of data.discussions ?? []) {
	await step(`discussion ${d.name}`, async () => {
		if (rooms.some((r) => r.name === d.name)) return count('discussions', false);
		const room = await obp('POST', chat, staff.token, { name: d.name, description: d.description });
		if (d.messages?.some((m) => m.by === 'startup'))
			await obp('POST', `/obp/v6.0.0/banks/${space}/chat-room-participants`, startup.token, { joining_key: room.joining_key });
		for (const m of d.messages ?? []) {
			await obp('POST', `${chat}/${encodeURIComponent(room.chat_room_id)}/messages`, owners[m.by].token, { content: m.text });
			count('discussion messages', true);
		}
		count('discussions', true);
	});
}

// ---- Retention policies: created switched off, as staff start them; OBP-API runs nothing until it is switched on ----

const policiesPath = `/obp/v7.0.0/management/banks/${space}/retention-policies`;
const policies = (await step('retention policies', () => obp('GET', policiesPath, staff.token)))?.retention_policies ?? [];
for (const policy of data.retention_policies ?? []) {
	await step(`retention policy ${policy.name}`, async () => {
		if (policies.some((r) => r.name === policy.name)) return count('retention policies', false);
		await obp('POST', policiesPath, staff.token, { ...policy, enabled: false });
		count('retention policies', true);
	});
}

for (const [what, c] of Object.entries(counts)) console.log(`${what}: ${c.created} created, ${c.existing} already there`);
if (errors.length) {
	console.log(`\n${errors.length} errors:`);
	for (const e of errors) console.log(`- ${e}`);
	process.exitCode = 1;
}
