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
import { eligibilityOf } from '$lib/applications';
import { nowUtc } from '$lib/screening';
import { APPLICATION, CALL, PROGRAMME } from './entities/definitions';
import { createRecord, idOf, listRecords, type CohortRecord } from './records';

/**
 * Example programmes, calls and applications, for demos and trying Cohort out. Programmes and calls are created
 * with the logged-in User's Roles; the applications are that User's own personal records. Adding them again skips
 * what already exists (matched by name, title, or call), so the button can be pressed more than once.
 */

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

interface ExampleCall {
	title: string;
	description: string;
	status: string;
	opens_at: string;
	closes_at: string;
	/** Applications to this call, by the logged-in User. */
	applications: CohortRecord[];
}

interface ExampleProgramme {
	programme: CohortRecord & { name: string };
	calls: ExampleCall[];
}

export function examples(): ExampleProgramme[] {
	return [
		{
			programme: {
				name: 'Example: Fintech Acceleration',
				description: 'A six-month programme for fintech startups with a working product: mentoring, sandbox access and investor days.',
				status: 'open',
				starts_on: day(30),
				ends_on: day(210)
			},
			calls: [
				{
					title: 'Example: Cohort 1 applications',
					description: 'Applications are open to fintech startups with a minimum viable product.',
					status: 'open',
					opens_at: day(-14),
					closes_at: day(30),
					applications: [
						{
							status: 'submitted',
							startup_name: 'Example Pay',
							sector: 'payments',
							stage: 'mvp',
							website: 'https://example.com',
							problem_statement: 'Small merchants cannot accept card payments cheaply.',
							solution: 'A QR payment app with low fees and same-day settlement.',
							market_understanding: 'Most small merchants still take only cash; card terminals cost too much for them.',
							team_size: 3,
							local_resident: true,
							incorporated_locally: true
						}
					]
				},
				{
					title: 'Example: Cohort 0 (closed)',
					description: 'The pilot cohort. Applications are closed.',
					status: 'closed',
					opens_at: day(-120),
					closes_at: day(-60),
					applications: []
				}
			]
		},
		{
			programme: {
				name: 'Example: Regtech Incubation',
				description: 'A three-month incubation track for early regtech ideas.',
				status: 'open',
				starts_on: day(45),
				ends_on: day(135)
			},
			calls: [
				{
					title: 'Example: Regtech ideas call',
					description: 'For teams with an idea for compliance, reporting or KYC tooling.',
					status: 'open',
					opens_at: day(-7),
					closes_at: day(45),
					applications: [
						{
							status: 'draft',
							startup_name: 'Example Comply',
							sector: 'regtech',
							stage: 'idea',
							problem_statement: 'Small banks spend weeks on each regulatory report.',
							team_size: 2,
							local_resident: false,
							incorporated_locally: false
						}
					]
				}
			]
		},
		{
			programme: {
				name: 'Example: Open Finance Lab (draft)',
				description: 'Being planned: not yet shown to applicants.',
				status: 'draft'
			},
			calls: [
				{
					title: 'Example: Open Finance Lab call (draft)',
					description: 'Not open yet.',
					status: 'draft',
					opens_at: day(60),
					closes_at: day(120),
					applications: []
				}
			]
		}
	];
}

export interface ExampleResult {
	programmes: number;
	calls: number;
	applications: number;
	skipped: number;
}

export async function addExampleData(token: string): Promise<ExampleResult> {
	const result: ExampleResult = { programmes: 0, calls: 0, applications: 0, skipped: 0 };
	const [programmes, calls, mine] = await Promise.all([
		listRecords(PROGRAMME, 'public'),
		listRecords(CALL, 'public'),
		listRecords(APPLICATION, 'my', token)
	]);
	for (const example of examples()) {
		let programme = programmes.find((p) => p.name === example.programme.name);
		if (programme) result.skipped++;
		else {
			programme = await createRecord(PROGRAMME, '', example.programme, token);
			result.programmes++;
		}
		const programmeId = idOf(PROGRAMME, programme);
		for (const { applications, ...fields } of example.calls) {
			let call = calls.find((c) => c.title === fields.title);
			if (call) result.skipped++;
			else {
				call = await createRecord(CALL, '', { ...fields, programme_id: programmeId }, token);
				result.calls++;
			}
			const callId = idOf(CALL, call);
			for (const application of applications) {
				if (mine.some((a) => a.call_id === callId)) {
					result.skipped++;
					continue;
				}
				const submitted = application.status === 'submitted'
					? { eligibility: eligibilityOf(application), submitted_at: nowUtc() }
					: {};
				await createRecord(APPLICATION, 'my', { ...application, call_id: callId, ...submitted }, token);
				result.applications++;
			}
		}
	}
	return result;
}
