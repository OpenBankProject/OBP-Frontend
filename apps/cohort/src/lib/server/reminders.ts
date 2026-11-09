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
import { createLogger } from '@obp/shared/utils';
import { reminderEmail } from '$lib/emails';
import { milestoneOf, todayUtc } from '$lib/milestones';
import { emailSettings } from './emailSettings';
import { planReminders } from '$lib/reminders';
import { nowUtc } from '$lib/screening';
import { requestApplicationAccessToken } from './applicationToken';
import { branding } from './branding';
import { APPLICATION, CALL, MILESTONE, MILESTONE_REVIEW, PARTICIPANT, REMINDER } from './entities/definitions';
import { reports, reviewOf } from './milestones';
import { emailCustomer, pageUrl } from './notify';
import { participantOf } from './participants';
import { createRecord, idOf, listRecords } from './records';

const logger = createLogger('CohortReminders');

/**
 * One pass of the reminders, as Cohort (no staff member sends them): read what it needs with its Scopes, plan the
 * reminders due today, email each one to its Customer, and record it so it is never sent again. A reminder is
 * recorded only once its email is queued, so a failed one is tried again on the next pass. Nothing read here is
 * shown to anyone.
 */
export async function runReminders(): Promise<{ sent: number; failed: number }> {
	const { token } = await requestApplicationAccessToken();
	if (!token) return { sent: 0, failed: 0 };
	const [participants, milestones, reportList, reviewList, applications, calls, sentList] = await Promise.all([
		listRecords(PARTICIPANT, '', token),
		listRecords(MILESTONE, 'public'),
		reports('community', token),
		listRecords(MILESTONE_REVIEW, '', token),
		listRecords(APPLICATION, 'community', token),
		listRecords(CALL, 'public'),
		listRecords(REMINDER, '', token)
	]);
	const applicantCustomer = new Map(applications.map((a) => [idOf(APPLICATION, a), String(a.customer_id ?? '')]));
	const settings = await emailSettings();
	const planned = planReminders({
		today: todayUtc(),
		dueSoonDays: settings.due_soon_days,
		closingSoonDays: settings.closing_soon_days,
		kinds: (['milestone_due', 'milestone_overdue', 'call_closing'] as const).filter((k) => settings[k]),
		milestones: milestones.map((m) => milestoneOf(idOf(MILESTONE, m), m)),
		participants: participants.map(participantOf).map((p) => ({
			id: p.id,
			programme_id: p.programme_id,
			startup_name: p.startup_name,
			status: p.status,
			// The startup's company once registered, else the applicant who represents it.
			customer_id: p.customer_id || applicantCustomer.get(p.application_id) || ''
		})),
		reports: reportList,
		reviews: reviewList.map(reviewOf),
		drafts: applications
			.filter((a) => a.status === 'draft')
			.map((a) => ({ id: idOf(APPLICATION, a), call_id: String(a.call_id ?? ''), startup_name: String(a.startup_name ?? ''), customer_id: String(a.customer_id ?? '') })),
		calls: calls.map((c) => ({ id: idOf(CALL, c), title: String(c.title ?? ''), closes_at: String(c.closes_at ?? ''), status: String(c.status ?? '') })),
		sent: new Set(sentList.map((r) => String(r.reminder_key ?? '')))
	});
	const site = (await branding().catch(() => null))?.name || 'Cohort';
	let sent = 0;
	let failed = 0;
	for (const r of planned) {
		const queued = await emailCustomer(
			r.customer_id,
			reminderEmail(r.kind, { site, startup: r.startup_name, about: r.about, on: r.on, link: pageUrl(r.path) }),
			`${REMINDER}:${r.key}`
		);
		if (!queued) {
			failed++;
			continue;
		}
		await createRecord(REMINDER, '', { reminder_key: r.key, kind: r.kind, about: r.about, startup_name: r.startup_name, customer_id: r.customer_id, sent_at: nowUtc() }, token).catch(
			(err) => logger.warn(`Reminder ${r.key} was emailed but not recorded, so it may be sent again:`, err)
		);
		sent++;
	}
	if (sent || failed) logger.info(`Reminders: ${sent} sent, ${failed} not sent (tried again next time)`);
	return { sent, failed };
}
