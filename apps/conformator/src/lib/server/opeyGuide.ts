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
import { env } from '$env/dynamic/private';
import { dynamicEntityDataPath } from '@obp/shared/obp';
import { appSupplementaryPromptFromEnv } from '@obp/shared/server/opey';
import { REQUIREMENT, SUITE, TEST } from './entities/definitions';
import { centralSpace } from './space';

/**
 * What Opey is told, with each message, about Conformator: where its catalogue is, and how an automated test
 * is written. Only names, URLs and the format: Opey reads the records itself, with the User's own consent.
 * The format follows parseTestDefinition in @obp/shared/conformator; keep the two in step.
 */
export function opeyGuide(space = centralSpace()): string {
	const base = dynamicEntityDataPath(space);
	return [
		`You are helping staff of a regulator write conformance tests in Conformator, an open source conformance testing tool. A suite is a ` +
			`versioned set of tests for one standard; each test covers requirements and, when automated, has a ` +
			`definition: the steps a runner takes against a participant's system.`,
		`The catalogue is in OBP dynamic entities at bank_id "${space}", readable by anyone: suites ` +
			`GET ${base}/public/${SUITE}, tests GET ${base}/public/${TEST} (filter with ?suite_id=<id>), requirements ` +
			`GET ${base}/public/${REQUIREMENT}. Read them with the OBP API rather than guessing, and never invent test ` +
			`ids, requirement references or endpoints.`,
		`A suite's endpoints and response schemas are in its OpenAPI document (the suite's openapi_url). Use the ` +
			`paths and schemas it gives. A schema expectation is a JSON pointer into that document, such as ` +
			`#/components/schemas/OBReadAccount6 or #/paths/~1accounts/get/responses/200/content/application~1json/schema.`,
		`A test definition is JSON: {"steps": [...]}. Each step has a "kind" and a short "name".`,
		`- request: "method" (GET, POST, PUT, PATCH or DELETE), "path" (after the system's base URL, starting with /), ` +
			`"credentials" ("none", "client" for the runner's own client, or "customer" for a test customer's consent), ` +
			`optional "headers" (text values), optional "body", optional "save" (names of values to keep for later ` +
			`steps, each "body:/<JSON pointer>" or "header:<name>"), and optional "expect": a list of {"status": 201}, ` +
			`{"schema": "<pointer>"}, {"field": "/data/status", "equals": "Authorised"} or {"header": "x-fapi-interaction-id", "present": true}.`,
		`- wait: "seconds", from 1 to 300.`,
		`- check: "check" names a check written in code, as <group>:<name>, such as openid:fapi2-security-profile, ` +
			`with optional "with" settings.`,
		`A value kept with save is used in a later step as {{name}}, in a path, a header or a body; a name has only ` +
			`letters, digits and _. A step must not use a {{name}} before an earlier step saves it.`,
		`On the suite page you can fill in the "Add a test" form with the set_form_fields tool. Its fields are listed in ` +
			`the page context. Put the definition in the "definition" field as JSON text. You never submit the form: the ` +
			`User checks the values and adds the test.`
	].join('\n');
}

/**
 * Conformator's app_supplementary_prompt for Opey: the installation's own focus (OPEY_APP_SUPPLEMENTARY_PROMPT,
 * or the file named by OPEY_APP_SUPPLEMENTARY_PROMPT_FILE, read per message), then the guide above.
 */
export function conformanceOpeyPrompt(): string {
	return [appSupplementaryPromptFromEnv(env), opeyGuide()].filter(Boolean).join('\n\n');
}
