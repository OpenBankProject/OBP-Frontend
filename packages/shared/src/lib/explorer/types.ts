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
/**
 * Types for the API Explorer: OBP resource docs, the trimmed index we ship to the
 * browser, and the API versions that make up the version picker.
 */

export interface ResourceDocRole {
	role: string;
	requires_bank_id: boolean;
}

export interface ResourceDocImplementation {
	version: string;
	function: string;
	technology?: string;
}

/**
 * One endpoint as OBP describes it in GET /resource-docs/{VERSION}/obp.
 *
 * Note the two URLs. `request_url` is where the endpoint was originally implemented
 * (and is *relative* for dynamic entities). `specified_url` is the endpoint as served
 * by the catalogue version you asked for: OBPv6.0.0-getBanks is `/obp/v6.0.0/banks`
 * in the v6 catalogue and `/obp/v7.0.0/banks` in the v7 one. Always prefer
 * `specified_url` — see endpointPath().
 */
export interface ResourceDoc {
	operation_id: string;
	request_verb: string;
	request_url: string;
	specified_url?: string;
	summary: string;
	description?: string;
	description_markdown?: string;
	roles?: ResourceDocRole[];
	tags?: string[];
	example_request_body?: unknown;
	success_response_body?: unknown;
	typed_success_response_body?: unknown;
	error_response_bodies?: string[];
	implemented_by?: ResourceDocImplementation;
	connector_methods?: string[];
	is_featured?: boolean;
	special_instructions?: string;
}

/**
 * The trimmed form of a resource doc. A full catalogue is ~6.7 MB for ~1,100
 * endpoints; the same catalogue as index entries is ~225 KB, ~33 KB gzipped, which is
 * small enough to hand the browser for instant search. Full docs stay on the server.
 */
export interface ResourceDocIndexEntry {
	operationId: string;
	verb: string;
	/** The catalogue-relative path, from specified_url. Always starts with "/". */
	path: string;
	summary: string;
	tags: string[];
}

/** One entry of GET /obp/{v}/api/versions -> scanned_api_versions. */
export interface ApiVersion {
	/** First path segment of a request URL: "obp", "berlin-group", "open-banking". */
	urlPrefix: string;
	/** The standard this version belongs to: "obp", "BG", "UK". */
	apiStandard: string;
	/** Second path segment: "v7.0.0", "v1.3", "dynamic-entity". */
	shortVersion: string;
	/** The catalogue identifier: "OBPv7.0.0", "BGv1.3", "OBPdynamic-entity". */
	fullyQualifiedVersion: string;
	isActive: boolean;
}
