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
import { Validator, type Schema } from '@cfworker/json-schema';
import { atPointer } from './checks';
import { parseOpenApiText } from '@obp/shared/conformator';

/**
 * Checking responses against the schemas of a suite's OpenAPI 3.1 document. OpenAPI 3.1 schemas are JSON Schema
 * 2020-12, so a validator for that draft checks them; OpenAPI's own extra keywords (example, discriminator) are ignored.
 */

/** The outcome of one schema check: the problems found (none means it passed), or why the check could not be made. */
export type SchemaOutcome = { problems: string[] } | { cannot: string };

export type SchemaCheck = (ref: string, value: unknown) => SchemaOutcome;

const BASE = 'https://openapi.invalid/suite';
const MAX_PROBLEMS = 5;

/** A schema check over one OpenAPI document. Refs are JSON pointers into it, such as #/components/schemas/Account. */
export function schemaChecker(document: unknown): SchemaCheck {
	const validators = new Map<string, Validator>();
	return (ref, value) => {
		if (!ref.startsWith('#/')) return { cannot: `The schema ${ref} is not a reference into the suite's OpenAPI document, such as #/components/schemas/Account.` };
		if (atPointer(document, ref.slice(1)) === undefined) return { cannot: `The suite's OpenAPI document has no schema at ${ref}.` };
		let validator = validators.get(ref);
		if (!validator) {
			// A pointer in a URI fragment is percent-encoded (RFC 6901, section 6), so braces in a path such as
			// /accounts/{accountid} reach the validator as %7B and %7D.
			const fragment = ref.slice(1).split('/').map((part) => encodeURIComponent(part).replace(/%7E/gi, '~')).join('/');
			validator = new Validator({ $ref: `${BASE}#${fragment}` } as Schema, '2020-12', false);
			validator.addSchema({ ...(document as object), $id: BASE } as Schema);
			validators.set(ref, validator);
		}
		const result = validator.validate(value);
		if (result.valid) return { problems: [] };
		// The validator reports each failing keyword and the ones that contain it; the innermost say the most.
		const specific = result.errors.filter((e) => e.keyword !== '$ref' && e.keyword !== 'properties' && e.keyword !== 'items' && e.keyword !== 'allOf');
		const shown = (specific.length ? specific : result.errors).slice(0, MAX_PROBLEMS).map((e) => `${e.instanceLocation.replace(/^#/, '') || '/'}: ${e.error}`);
		return { problems: shown };
	};
}

/** Read an OpenAPI document from its text, in JSON or YAML, or say why it cannot be used. */
export function parseOpenApi(text: string, source: string): { document: unknown } | { cannot: string } {
	let document: any;
	try {
		document = parseOpenApiText(text);
	} catch (err) {
		return { cannot: `The OpenAPI document at ${source} cannot be read. ${err instanceof Error ? err.message : String(err)}` };
	}
	// OpenAPI 3.0 schemas are close enough to JSON Schema for these checks; Swagger 2.0 documents are shaped differently.
	if (typeof document?.openapi !== 'string' || !/^3\.[01]/.test(document.openapi))
		return { cannot: `The document at ${source} is not OpenAPI 3.0 or 3.1 (it says ${String(document?.openapi ?? document?.swagger ?? 'nothing')}).` };
	return { document };
}
