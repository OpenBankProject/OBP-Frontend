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
import { env } from '$env/dynamic/public';
import { obpRequests } from './obp';

/**
 * Evidence files, kept as OBP files in the participant's space and attached to evidence records. Uploading needs
 * CanCreateFileAtOneBank there and reading CanGetFileAtOneBank: OBP-API decides who sees what.
 */

export interface EvidenceFile {
	file_id: string;
	file_name: string;
	media_type: string;
	size_in_bytes: number;
	scan_status: string;
}

/** The types OBP-API accepts for files; its own list for the space is the final word. */
export const EVIDENCE_MEDIA_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

const filesPath = (space: string) => `/obp/v7.0.0/banks/${encodeURIComponent(space)}/files`;

function toFile(f: any): EvidenceFile {
	return {
		file_id: String(f.file_id),
		file_name: String(f.file_name ?? ''),
		media_type: String(f.media_type ?? ''),
		size_in_bytes: Number(f.size_in_bytes ?? 0),
		scan_status: String(f.scan_status ?? 'clean')
	};
}

/** The files attached to a record that the caller may read. */
export async function filesOf(space: string, recordType: string, recordId: string, token: string): Promise<EvidenceFile[]> {
	const query = new URLSearchParams({ record_type: recordType, record_id: recordId });
	return ((await obpRequests.get(`${filesPath(space)}?${query}`, token))?.files ?? []).map(toFile);
}

/** Upload a file to the space and attach it to a record. */
export async function attachFile(space: string, recordType: string, recordId: string, file: File, token: string): Promise<EvidenceFile> {
	const bytes = Buffer.from(await file.arrayBuffer());
	const created = toFile(
		await obpRequests.post(filesPath(space), { file_name: file.name, media_type: file.type, content_base64: bytes.toString('base64') }, token)
	);
	await obpRequests.post(`${filesPath(space)}/${encodeURIComponent(created.file_id)}/attachments`, { record_type: recordType, record_id: recordId }, token);
	return created;
}

/** A problem with an upload before it is sent, or null. */
export function uploadProblem(file: File): string | null {
	if (!EVIDENCE_MEDIA_TYPES.includes(file.type)) return `${file.name} is not a PDF, PNG, JPEG or WebP file.`;
	if (file.size > MAX_EVIDENCE_BYTES) return `${file.name} is larger than 5 MB.`;
	return null;
}

/** The raw response for a file's content, for the download route to pass on. OBP refuses what may not be served. */
export async function fileContent(space: string, fileId: string, token: string): Promise<Response> {
	return fetch(`${env.PUBLIC_OBP_BASE_URL}${filesPath(space)}/${encodeURIComponent(fileId)}/content`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(30_000)
	});
}
