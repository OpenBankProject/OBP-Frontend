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
import { dynamicEntityDataPath } from '@obp/shared/obp';
import { obpRequests } from './obp';
import { cohortSpace } from './space';

/**
 * Reading and writing Cohort's Dynamic Entity records at their v7.0.0 URLs. `access` picks the URL form:
 * '' (Roles at the space), 'my' (the caller's own personal records), 'public' (anyone, read only) or
 * 'community' (every record, read only, for holders of the Get Role). The space is Cohort's unless given (the forms
 * space holds the answers to published forms).
 */
export type Access = '' | 'my' | 'public' | 'community';

export type CohortRecord = Record<string, unknown>;

function path(entity: string, access: Access, id?: string, space = cohortSpace()): string {
	const base = dynamicEntityDataPath(space);
	const prefix = access ? `${access}/` : '';
	return `${base}/${prefix}${encodeURIComponent(entity)}${id ? `/${encodeURIComponent(id)}` : ''}`;
}

/** The id field of a record: `<entity>_id`. */
export function idOf(entity: string, record: CohortRecord): string {
	return String(record[`${entity}_id`] ?? '');
}

/** The records of a v7.0.0 list response, unwrapped from their `{ <entity>: record, metadata }` items. */
export function unwrapList(entity: string, response: any): CohortRecord[] {
	const items: any[] = response?.[`${entity}_list`] ?? [];
	return items.map((item) => item?.[entity]).filter((record): record is CohortRecord => record != null);
}

/** Who created and last updated a record, and when; user ids are absent on public reads. */
export interface RecordMetadata {
	created?: { at?: string | null; user_id?: string | null; on_behalf_of_user_id?: string | null };
	updated?: { at?: string | null; user_id?: string | null; on_behalf_of_user_id?: string | null };
}

/** The records of a v7.0.0 list response with their metadata. */
export function unwrapListWithMetadata(entity: string, response: any): { record: CohortRecord; metadata: RecordMetadata }[] {
	const items: any[] = response?.[`${entity}_list`] ?? [];
	return items
		.filter((item) => item?.[entity] != null)
		.map((item) => ({ record: item[entity] as CohortRecord, metadata: (item.metadata ?? {}) as RecordMetadata }));
}

export async function listRecordsWithMetadata(entity: string, access: Access, token?: string) {
	return unwrapListWithMetadata(entity, await obpRequests.get(path(entity, access), token));
}

export async function getRecordWithMetadata(entity: string, access: Access, id: string, token?: string) {
	const response = await obpRequests.get(path(entity, access, id), token);
	return { record: response?.[entity] as CohortRecord, metadata: (response?.metadata ?? {}) as RecordMetadata };
}

export async function listRecords(entity: string, access: Access, token?: string, space?: string): Promise<CohortRecord[]> {
	return unwrapList(entity, await obpRequests.get(path(entity, access, undefined, space), token));
}

export async function getRecord(entity: string, access: Access, id: string, token?: string): Promise<CohortRecord> {
	return (await obpRequests.get(path(entity, access, id), token))?.[entity] as CohortRecord;
}

export async function createRecord(entity: string, access: Access, body: CohortRecord, token: string, space?: string): Promise<CohortRecord> {
	return (await obpRequests.post(path(entity, access, undefined, space), body, token))?.[entity] as CohortRecord;
}

export async function updateRecord(entity: string, access: Access, id: string, body: CohortRecord, token: string, space?: string): Promise<CohortRecord> {
	return (await obpRequests.put(path(entity, access, id, space), body, token))?.[entity] as CohortRecord;
}

export async function deleteRecord(entity: string, access: Access, id: string, token: string): Promise<void> {
	await obpRequests.delete(path(entity, access, id), token);
}

/** The logged-in User's access token, for calls made as them. */
export function userToken(locals: App.Locals): string | undefined {
	return locals.session.data.oauth?.access_token;
}
