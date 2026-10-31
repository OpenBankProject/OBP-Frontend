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
import { env } from '$env/dynamic/public';
import { obpRequests } from './obp';
import { cohortSpace } from './space';
import { APPLICATION } from './entities/definitions';

/**
 * Applicant files, as OBP personal files: uploaded in the applicant's own name, attached to their application,
 * pending until scanned. Every call is made with the logged-in User's token, so OBP decides who sees what.
 */

/** What Cohort shows about a file. Never a preview: staff open a file only by downloading it on purpose. */
export interface CohortFile {
	file_id: string;
	file_name: string;
	media_type: string;
	size_in_bytes: number;
	scan_status: string;
	scan_status_reason: string;
	owner_user_id: string;
	created_at: string;
}

/** The types an applicant may upload; OBP's own list for the space is the final word. */
export const UPLOAD_MEDIA_TYPES: Record<string, string> = {
	'application/pdf': '.pdf',
	'image/png': '.png',
	'image/jpeg': '.jpg,.jpeg'
};

/** Larger uploads are refused before they are sent to OBP; OBP's own limit applies too. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const filesPath = () => `/obp/v7.0.0/banks/${encodeURIComponent(cohortSpace())}/files`;

function toCohortFile(f: any): CohortFile {
	return {
		file_id: String(f.file_id),
		file_name: String(f.file_name ?? ''),
		media_type: String(f.media_type ?? ''),
		size_in_bytes: Number(f.size_in_bytes ?? 0),
		scan_status: String(f.scan_status ?? 'clean'),
		scan_status_reason: String(f.scan_status_reason ?? ''),
		owner_user_id: String(f.owner_user_id ?? ''),
		created_at: String(f.created_at ?? '')
	};
}

/** The files attached to an application that the caller may read: their own, or all with CanGetFileAtOneBank. */
export async function filesOfApplication(applicationId: string, token: string): Promise<CohortFile[]> {
	const query = new URLSearchParams({ record_type: APPLICATION, record_id: applicationId });
	const response = await obpRequests.get(`${filesPath()}?${query}`, token);
	return (response?.files ?? []).map(toCohortFile);
}

/** Store a personal file in the applicant's name, attached to their application. */
export async function uploadApplicationFile(applicationId: string, file: File, token: string): Promise<CohortFile> {
	const bytes = Buffer.from(await file.arrayBuffer());
	const created = await obpRequests.post(`/obp/v7.0.0/banks/${encodeURIComponent(cohortSpace())}/my/files`, {
		file_name: file.name,
		media_type: file.type,
		content_base64: bytes.toString('base64'),
		record_type: APPLICATION,
		record_id: applicationId
	}, token);
	return toCohortFile(created);
}

export async function setScanStatus(fileId: string, status: 'clean' | 'rejected', reason: string, token: string) {
	return toCohortFile(await obpRequests.put(`${filesPath()}/${encodeURIComponent(fileId)}/scan-status`, { scan_status: status, reason }, token));
}

/** The raw response for a file's content, for the download route to pass on. OBP refuses what is not servable. */
export async function fetchFileContent(fileId: string, token: string): Promise<Response> {
	return fetch(`${env.PUBLIC_OBP_BASE_URL}${filesPath()}/${encodeURIComponent(fileId)}/content`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(30_000)
	});
}
