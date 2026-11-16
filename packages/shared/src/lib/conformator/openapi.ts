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
import { parse as parseYaml } from 'yaml';
import type { HttpMethod, RequestStep } from './definition.js';

/**
 * The operations of an OpenAPI document, for choosing an endpoint when writing a test, and for turning one into a step.
 * The document is the suite's own: OBP's for a standard it implements, or a file given to the suite.
 */

export interface Operation {
	method: HttpMethod;
	path: string;
	operationId: string;
	summary: string;
	tag: string;
	/** The first 2xx status the document gives, as a number; 200 when it gives none. */
	successStatus: number;
	/** A JSON pointer to that response's JSON schema in the document, for a schema check; null when it has none. */
	schemaPointer: string | null;
	/** Whether the operation takes a request body. */
	hasBody: boolean;
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/** One part of a JSON pointer, escaped as RFC 6901 says: ~ as ~0 and / as ~1. */
function escape(part: string): string {
	return part.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * A response's JSON schema, as a JSON pointer into the document, or null when it has none. A response may be a
 * reference to a shared one under components, as in the UK Open Banking and Berlin Group files; the pointer then goes
 * to the shared one. Its JSON media type may carry parameters, such as "application/json; charset=utf-8".
 */
function responseSchemaPointer(document: unknown, response: any, pointer: string): string | null {
	// Follow references to shared responses, a few at most, in case two refer to each other.
	for (let hops = 0; hops < 5 && typeof response?.$ref === 'string'; hops++) {
		if (!response.$ref.startsWith('#/')) return null;
		pointer = response.$ref;
		response = resolvePointer(document, pointer);
	}
	const content = response?.content;
	if (!content || typeof content !== 'object') return null;
	const types = Object.keys(content);
	const json = types.includes('application/json') ? 'application/json' : types.find((t) => /^application\/([\w.+-]*\+)?json\s*(;|$)/i.test(t));
	return json && content[json]?.schema ? `${pointer}/content/${escape(json)}/schema` : null;
}

/** The value a "#/..." JSON pointer names in the document, or undefined. */
function resolvePointer(document: unknown, pointer: string): any {
	let value: any = document;
	for (const raw of pointer.replace(/^#\/?/, '').split('/')) {
		if (value === null || typeof value !== 'object') return undefined;
		value = value[decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~')];
	}
	return value;
}

/** Every operation in the document, in path order, then method order. Anything that is not an operation is skipped. */
export function openApiOperations(document: unknown): Operation[] {
	const paths = (document as { paths?: Record<string, Record<string, any>> })?.paths;
	if (!paths || typeof paths !== 'object') return [];
	const out: Operation[] = [];
	for (const path of Object.keys(paths).sort()) {
		const item = paths[path] ?? {};
		for (const method of METHODS) {
			const op = item[method.toLowerCase()];
			if (!op || typeof op !== 'object') continue;
			const responses: Record<string, any> = op.responses ?? {};
			const success = Object.keys(responses).find((code) => /^2\d\d$/.test(code));
			out.push({
				method,
				path,
				operationId: typeof op.operationId === 'string' ? op.operationId : `${method} ${path}`,
				summary: typeof op.summary === 'string' ? op.summary : '',
				tag: Array.isArray(op.tags) && typeof op.tags[0] === 'string' ? op.tags[0] : 'Other',
				successStatus: success ? Number(success) : 200,
				schemaPointer: success ? responseSchemaPointer(document, responses[success], `#/paths/${escape(path)}/${method.toLowerCase()}/responses/${success}`) : null,
				hasBody: Boolean(op.requestBody)
			});
		}
	}
	return out;
}

/**
 * A first step for testing an operation: call it as the runner's own client and expect its success status, and its
 * response schema when the document has one. A path parameter such as {accountid} becomes {{accountid}}, for an earlier
 * step to keep. A placeholder name has only letters, digits and _, so {payment-service} becomes {{payment_service}}.
 * The author then adjusts the credentials, the body and what to keep.
 */
export function stepForOperation(op: Operation): RequestStep {
	return {
		kind: 'request',
		name: op.summary || op.operationId,
		method: op.method,
		path: op.path.replace(/\{([^{}]+)\}/g, (_, name: string) => `{{${name.replace(/[^A-Za-z0-9_]/g, '_')}}}`),
		credentials: 'client',
		...(op.hasBody ? { body: {} } : {}),
		expect: [{ status: op.successStatus }, ...(op.schemaPointer ? [{ schema: op.schemaPointer }] : [])]
	};
}

/**
 * Read the text of an OpenAPI document, in JSON or YAML. The UK Open Banking files come in both; the Berlin Group
 * publishes YAML only. JSON is tried first, as it is quicker to read. Throws an Error that says the text is neither.
 */
export function parseOpenApiText(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		// Not JSON: read it as YAML below.
	}
	try {
		// The YAML reader limits aliases (maxAliasCount), so a small file cannot expand into a huge document.
		return parseYaml(text);
	} catch (err) {
		throw new Error(`The document is neither JSON nor YAML (${err instanceof Error ? err.message.split('\n')[0] : String(err)}).`);
	}
}
