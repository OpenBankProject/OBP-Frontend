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
import { dynamicEntityDataPath } from '@obp/shared/obp';
import { obpRequests } from './obp';
import { centralSpace } from './space';

/**
 * Reading and writing dynamic entity records at their v7.0.0 URLs, in the central space or a participant's space.
 * `access` picks the URL form: '' (Roles at the space) or 'public' (anyone, read only).
 */
export type Access = '' | 'public';

// Fields are read by name on every page; `any` keeps their names through spreads, which `unknown` would lose.
export type EntityRecord = Record<string, any>;

/** Who created and last updated a record, and when; user ids are absent on public reads. */
export interface RecordMetadata {
	created?: { at?: string | null; user_id?: string | null };
	updated?: { at?: string | null; user_id?: string | null };
}

export interface Located {
	space?: string;
	access?: Access;
}

function path(entity: string, where: Located, id?: string): string {
	const base = dynamicEntityDataPath(where.space ?? centralSpace());
	const prefix = where.access ? `${where.access}/` : '';
	return `${base}/${prefix}${encodeURIComponent(entity)}${id ? `/${encodeURIComponent(id)}` : ''}`;
}

/** The id field of a record: `<entity>_id`. */
export function idOf(entity: string, record: EntityRecord): string {
	return String(record[`${entity}_id`] ?? '');
}

/** The records of a v7.0.0 list response with their metadata, unwrapped from their `{ <entity>: record, metadata }` items. */
export function unwrapList(entity: string, response: any): { record: EntityRecord; metadata: RecordMetadata }[] {
	const items: any[] = response?.[`${entity}_list`] ?? [];
	return items
		.filter((item) => item?.[entity] != null)
		.map((item) => ({ record: item[entity] as EntityRecord, metadata: (item.metadata ?? {}) as RecordMetadata }));
}

export async function listRecords(entity: string, token: string | undefined, where: Located = {}) {
	return unwrapList(entity, await obpRequests.get(path(entity, where), token));
}

export async function getRecord(entity: string, id: string, token: string | undefined, where: Located = {}) {
	const response = await obpRequests.get(path(entity, where, id), token);
	return { record: response?.[entity] as EntityRecord, metadata: (response?.metadata ?? {}) as RecordMetadata };
}

export async function createRecord(entity: string, body: EntityRecord, token: string, where: Located = {}): Promise<EntityRecord> {
	return (await obpRequests.post(path(entity, where), body, token))?.[entity] as EntityRecord;
}

export async function updateRecord(entity: string, id: string, body: EntityRecord, token: string, where: Located = {}): Promise<EntityRecord> {
	return (await obpRequests.put(path(entity, where, id), body, token))?.[entity] as EntityRecord;
}

/** The logged-in User's access token, for calls made as them. */
export function userToken(locals: App.Locals): string | undefined {
	return locals.session.data.oauth?.access_token;
}

/** A record's own fields, without its id, for writing it back whole (a save replaces the whole record). */
export function fieldsOf(entity: string, record: EntityRecord): EntityRecord {
	const { [`${entity}_id`]: _id, ...rest } = record;
	return rest;
}
