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
import { randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { createRecord, idOf, listRecords, type EntityRecord } from './records';
import { PARTICIPANT, REPORT, REPORT_EVENT } from './entities/definitions';
import { canonicalJson, hashOf, signerFromFile, verifyReport, type Signer } from './reportSigning';
import { spaceName } from './spaces';
import type { LoadedSubmission } from './submissions';

/** What every report says about itself, in its signed content. */
export const REPORT_STATEMENT =
	'This report evidences the technical conformance tests listed in it only. It is not a licence or a regulatory approval, and it does not authorise access to live data or payments.';

let cachedSigner: { signer: Signer | null; problem: string | null } | null = null;

/** The report signer, from REPORT_SIGNING_KEY_FILE, read once. */
export function reportSigner() {
	cachedSigner ??= signerFromFile(env.REPORT_SIGNING_KEY_FILE?.trim());
	return cachedSigner;
}

/** How long a report is valid, in months (REPORT_VALID_MONTHS, default 12). */
function validMonths(): number {
	const n = Number(env.REPORT_VALID_MONTHS ?? 12);
	return Number.isInteger(n) && n > 0 ? n : 12;
}

/** A new reference such as CR-2026-7K3QX9MD: the year and eight random letters and digits, without look-alikes. */
export function newReference(year: number, random: Buffer = randomBytes(8)): string {
	const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	return `CR-${year}-${[...random].map((b) => alphabet[b % alphabet.length]).join('')}`;
}

function addMonths(isoDate: string, months: number): string {
	const d = new Date(`${isoDate}T00:00:00Z`);
	d.setUTCMonth(d.getUTCMonth() + months);
	return d.toISOString().slice(0, 10);
}

/**
 * Issue the signed report for an approved submission, with the approver's own Roles (creating reports in the central
 * space). Earlier reports for the same participant, system and suite are marked superseded by it.
 */
export async function issueReport(space: string, s: LoadedSubmission, approval: EntityRecord, token: string): Promise<string> {
	const { signer, problem } = reportSigner();
	if (!signer) throw new Error(problem ?? 'No report signing key.');
	if (!s.system || !s.suite) throw new Error("The submission's system or suite cannot be read.");

	const participants = await listRecords(PARTICIPANT, token).catch(() => []);
	const participant = participants.map((p) => p.record).find((p) => p.space_id === space);
	const existing = (await listRecords(REPORT, undefined, { access: 'public' })).map((r) => r.record);
	let reference = newReference(new Date().getUTCFullYear());
	while (existing.some((r) => r.reference === reference)) reference = newReference(new Date().getUTCFullYear());

	const issuedOn = new Date().toISOString().slice(0, 10);
	const expiresOn = addMonths(issuedOn, validMonths());
	const testTitle = new Map(s.tests.map((t) => [String(t.test_id), String(t.title)]));
	const content = canonicalJson({
		reference,
		statement: REPORT_STATEMENT,
		issued_on: issuedOn,
		expires_on: expiresOn,
		participant: {
			participant_id: participant ? idOf(PARTICIPANT, participant) : '',
			legal_name: participant ? String(participant.legal_name) : await spaceName(space, token),
			category: participant ? String(participant.category) : '',
			space_id: space
		},
		system: { system_id: idOf('conformator_system', s.system), name: String(s.system.name), system_role: String(s.system.system_role), base_url: String(s.system.base_url) },
		suite: { suite_id: String(s.submission.suite_id), code: String(s.suite.code), name: String(s.suite.name), version: String(s.suite.version) },
		submission_id: idOf('conformator_submission', s.submission),
		run_ids: s.runIds,
		approval: { approval_id: idOf('conformator_approval', approval), reason: String(approval.reason ?? ''), approved_by_user_id: String(approval.created_by ?? '') },
		tests: s.rows.map((r) => ({
			test_id: r.test_id,
			title: testTitle.get(r.test_id) ?? '',
			mandatory: r.mandatory,
			outcome: r.outcome,
			decided_by: r.source,
			...(r.waiver ? { waiver: r.waiver } : {})
		}))
	});
	const reportHash = hashOf(content);
	const created = await createRecord(
		REPORT,
		{
			reference,
			participant_id: participant ? idOf(PARTICIPANT, participant) : '',
			system_id: idOf('conformator_system', s.system),
			suite_id: String(s.submission.suite_id),
			submission_id: idOf('conformator_submission', s.submission),
			issued_on: issuedOn,
			expires_on: expiresOn,
			report_hash: reportHash,
			signature: signer.sign(reportHash),
			signing_key_id: signer.keyId,
			content
		},
		token
	);

	// Earlier reports for this participant's same system and suite code are replaced by this one.
	const events = (await listRecords(REPORT_EVENT, undefined, { access: 'public' }).catch(() => [])).map((e) => e.record);
	for (const old of existing) {
		const sameSystem = old.system_id === idOf('conformator_system', s.system) && old.participant_id === (participant ? idOf(PARTICIPANT, participant) : '');
		const oldCode = (() => {
			try {
				return JSON.parse(String(old.content ?? '{}'))?.suite?.code;
			} catch {
				return undefined;
			}
		})();
		const ended = events.some((e) => e.report_id === idOf(REPORT, old));
		if (sameSystem && oldCode === s.suite.code && !ended)
			await createRecord(
				REPORT_EVENT,
				{ report_id: idOf(REPORT, old), event: 'superseded', reason: `Superseded by ${reference}.`, replaced_by_report_id: idOf(REPORT, created) },
				token
			).catch(() => {});
	}
	return reference;
}

export type ReportStanding = 'valid' | 'expired' | 'superseded' | 'withdrawn';

/** A report found by its reference, checked: its standing, and whether its hash and signature hold. */
export async function findReport(reference: string) {
	const reports = (await listRecords(REPORT, undefined, { access: 'public' })).map((r) => r.record);
	const report = reports.find((r) => r.reference === reference);
	if (!report) return null;
	const events = (await listRecords(REPORT_EVENT, undefined, { access: 'public' }).catch(() => []))
		.map((e): EntityRecord => ({ ...e.record, created_at: e.metadata.created?.at ?? '' }))
		.filter((e) => e.report_id === idOf(REPORT, report));
	const ending = events.find((e) => e.event === 'withdrawn') ?? events.find((e) => e.event === 'superseded');
	const today = new Date().toISOString().slice(0, 10);
	const standing: ReportStanding = ending ? (ending.event as ReportStanding) : String(report.expires_on) < today ? 'expired' : 'valid';
	const { signer } = reportSigner();
	const check = verifyReport(String(report.content ?? ''), String(report.report_hash), String(report.signature), String(report.signing_key_id), signer?.publicKeyPem ?? null);
	let content: any = {};
	try {
		content = JSON.parse(String(report.content ?? '{}'));
	} catch {
		content = {};
	}
	const replacedBy = ending?.replaced_by_report_id ? reports.find((r) => idOf(REPORT, r) === ending.replaced_by_report_id)?.reference ?? null : null;
	return { report, content, standing, ending: ending ?? null, replacedBy, check };
}

/** Every report with its standing and parsed content, for the dashboard. Public data: no token needed. */
export async function allReports(): Promise<Array<{ report: EntityRecord; standing: ReportStanding; content: any }>> {
	const [reports, events] = await Promise.all([
		listRecords(REPORT, undefined, { access: 'public' }).then((l) => l.map((r) => r.record)),
		listRecords(REPORT_EVENT, undefined, { access: 'public' }).then((l) => l.map((e) => e.record)).catch(() => [] as EntityRecord[])
	]);
	const today = new Date().toISOString().slice(0, 10);
	return reports.map((report) => {
		const own = events.filter((e) => e.report_id === idOf(REPORT, report));
		const ending = own.find((e) => e.event === 'withdrawn') ?? own.find((e) => e.event === 'superseded');
		const standing: ReportStanding = ending ? (ending.event as ReportStanding) : String(report.expires_on) < today ? 'expired' : 'valid';
		let content: any = {};
		try {
			content = JSON.parse(String(report.content ?? '{}'));
		} catch {
			content = {};
		}
		return { report, standing, content };
	});
}
