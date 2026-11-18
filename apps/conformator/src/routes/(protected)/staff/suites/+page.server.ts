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
import { fail, redirect } from '@sveltejs/kit';
import { API_FAMILIES, isOneOf, parseOpenApiText, SYSTEM_ROLES } from '@obp/shared/conformator';
import { createRecord, fieldsOf, idOf, listRecords, updateRecord, userToken } from '$lib/server/records';
import { SUITE } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { fields, isDocumentUrl } from '$lib/server/forms';
import { roleCheck } from '$lib/server/staffAccess';
import { centralSpace } from '$lib/server/space';
import { loadIntoDynamicEndpoints, obpApiVersions, obpVersionOpenApiUrl, openApiFileProblem, servedOpenApiPath } from '$lib/server/sources';
import type { Actions, PageServerLoad } from './$types';

const CREATE_ROLE = `CanCreateDynamicEntityRecord_${SUITE}`;
const UPDATE_ROLE = `CanUpdateDynamicEntityRecord_${SUITE}`;
const LOAD_ROLE = 'CanCreateBankLevelDynamicEndpoint';
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const load: PageServerLoad = async ({ locals }) => {
	const can = await roleCheck(userToken(locals)!);
	const [suites, versions] = await Promise.all([
		listRecords(SUITE, undefined, { access: 'public' }).then((l) =>
			l.map((r) => r.record).sort((a, b) => String(a.code).localeCompare(String(b.code)) || String(b.version).localeCompare(String(a.version), undefined, { numeric: true }))
		),
		obpApiVersions().catch(() => [])
	]);
	return {
		suites,
		versions,
		systemRoles: SYSTEM_ROLES,
		apiFamilies: API_FAMILIES,
		canCreate: can(CREATE_ROLE),
		canLoad: can(LOAD_ROLE) && can(UPDATE_ROLE),
		createRole: CREATE_ROLE,
		loadRoles: [LOAD_ROLE, UPDATE_ROLE],
		space: centralSpace()
	};
};

export const actions: Actions = {
	create: async ({ locals, request, url }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const { text, problems } = fields(form);
		const source = text('source', 'Where the endpoints come from');
		const body: Record<string, unknown> = {
			code: text('code', 'The code', { required: true, max: 32 }).toUpperCase(),
			name: text('name', 'The name', { required: true, max: 255 }),
			version: text('version', 'The version', { required: true, max: 32 }),
			system_role: text('system_role', 'What the suite tests', { required: true }),
			api_family: text('api_family', 'The APIs', { required: true }),
			description: text('description', 'The description', { max: 4000 }),
			status: 'draft',
			source_kind: ''
		};
		const values = { ...body, source, obp_api_version: text('obp_api_version', 'The OBP API version'), openapi_url: text('openapi_url', 'The OpenAPI address', { max: 500 }) };
		if (body.code && !/^[A-Z0-9-]{2,32}$/.test(String(body.code))) problems.push('The code may use only letters, digits and hyphens.');
		if (!isOneOf(SYSTEM_ROLES, body.system_role)) problems.push('Choose what the suite tests.');
		if (!isOneOf(API_FAMILIES, body.api_family)) problems.push('Choose the APIs the suite covers.');

		let fileDocument: Record<string, unknown> | null = null;
		if (source === 'obp_version') {
			const versions = await obpApiVersions().catch(() => []);
			if (!versions.some((v) => v.version === values.obp_api_version)) problems.push('Choose one of the API versions OBP-API runs.');
			else Object.assign(body, { source_kind: 'obp_version', obp_api_version: values.obp_api_version, openapi_url: obpVersionOpenApiUrl(values.obp_api_version) });
		} else if (source === 'openapi_url') {
			if (!isDocumentUrl(values.openapi_url)) problems.push('The OpenAPI address must start with https:// (or http://localhost while trying it out).');
			else Object.assign(body, { source_kind: 'openapi_url', openapi_url: values.openapi_url });
		} else if (source === 'openapi_dynamic') {
			const file = form.get('openapi_file');
			if (!(file instanceof File) || file.size === 0) problems.push('Choose the OpenAPI file to load.');
			else if (file.size > MAX_FILE_BYTES) problems.push('The OpenAPI file is larger than 5 MB.');
			else {
				try {
					fileDocument = parseOpenApiText(await file.text()) as Record<string, unknown>;
					const problem = openApiFileProblem(fileDocument);
					if (problem) problems.push(problem);
				} catch (err) {
					problems.push(`The OpenAPI file cannot be read. ${messageOf(err)}`);
				}
			}
		} else if (source !== '') problems.push('Choose where the endpoints come from.');
		if (problems.length) return fail(400, { problems, values });

		let created;
		try {
			if (fileDocument) {
				const dynamicId = await loadIntoDynamicEndpoints(fileDocument, form.get('mock') === 'on', token);
				Object.assign(body, { source_kind: 'openapi_dynamic', dynamic_endpoint_id: dynamicId });
			}
			created = await createRecord(SUITE, body, token);
			// A loaded file's document is served by this app, under the suite's own id.
			if (fileDocument) {
				const id = idOf(SUITE, created);
				await updateRecord(SUITE, id, { ...fieldsOf(SUITE, created), openapi_url: `${url.origin}${servedOpenApiPath(id)}` }, token);
			}
		} catch (err) {
			return fail(400, { problems: [messageOf(err)], values });
		}
		redirect(303, `/staff/suites/${encodeURIComponent(idOf(SUITE, created))}`);
	}
};
