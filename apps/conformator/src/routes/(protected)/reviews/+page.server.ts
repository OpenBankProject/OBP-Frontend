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
import { idOf, listRecords, userToken, type EntityRecord } from '$lib/server/records';
import { APPROVAL, REVIEW_ASSIGNMENT, SUBMISSION } from '$lib/server/entities/definitions';
import { mySpaces } from '$lib/server/spaces';
import { submissionStatus } from '$lib/review';
import type { PageServerLoad } from './$types';

/** Every submission the User can read, in every participant's space, waiting ones first. */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const me = locals.session.data.user?.user_id ?? '';
	const spaces = await mySpaces(token, `CanGetDynamicEntityRecord_${SUBMISSION}`);
	const perSpace = await Promise.all(
		spaces.map(async (space) => {
			const [subs, approvals, assignments] = await Promise.all([
				listRecords(SUBMISSION, token, { space: space.id }).catch(() => []),
				listRecords(APPROVAL, token, { space: space.id }).catch(() => []),
				listRecords(REVIEW_ASSIGNMENT, token, { space: space.id }).catch(() => [])
			]);
			return subs.map(({ record }): EntityRecord => {
				const id = idOf(SUBMISSION, record);
				const of = (list: typeof approvals) => list.map((r): EntityRecord => ({ ...r.record, created_at: r.metadata.created?.at ?? '' })).filter((r) => r.submission_id === id);
				const assigned = of(assignments);
				return {
					id,
					space: space.id,
					space_name: space.name,
					submitted_at: String(record.submitted_at ?? ''),
					status: submissionStatus(of(approvals), assigned),
					mine: assigned.some((a) => a.reviewer_user_id === me)
				};
			});
		})
	);
	const order: Record<string, number> = { submitted: 0, under_review: 1, refused: 2, approved: 3 };
	const submissions = perSpace.flat().sort((a, b) => order[a.status] - order[b.status] || String(a.submitted_at).localeCompare(String(b.submitted_at)));
	return { submissions };
};
