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
 * Form validation and payload conversion for OBP dynamic entity records.
 *
 * Field definitions come from the dynamic entity's JSON schema
 * (`schema.properties` / `schema.required`). Values are validated against the
 * OBP dynamic entity field types (string, integer, number, boolean, json,
 * DATE_WITH_DAY) and converted to the wire format the OBP dynamic entity
 * data endpoints expect.
 */

export interface DynamicEntityFieldDef {
	type?: string;
	description?: string;
	example?: unknown;
	minimum?: number;
	maximum?: number;
	minLength?: number;
	maxLength?: number;
}

export type DynamicEntityProperties = Record<string, DynamicEntityFieldDef>;

/**
 * Validate a single field value. Returns an error message, or null if valid.
 *
 * Note: emptiness is checked with explicit null/undefined/"" comparisons —
 * 0 and false are valid values for required integer/number/boolean fields.
 */
export function validateDynamicEntityField(
	fieldDef: DynamicEntityFieldDef,
	isRequired: boolean,
	value: unknown
): string | null {
	if (isRequired && (value === null || value === undefined || value === '')) {
		return 'This field is required';
	}

	if (value !== null && value !== undefined && value !== '') {
		switch (fieldDef.type) {
			case 'integer':
			case 'number': {
				const num = Number(value);
				if (isNaN(num)) {
					return 'Must be a valid number';
				}
				if (fieldDef.type === 'integer' && !Number.isInteger(num)) {
					return 'Must be an integer';
				}
				if (fieldDef.minimum !== undefined && num < fieldDef.minimum) {
					return `Must be at least ${fieldDef.minimum}`;
				}
				if (fieldDef.maximum !== undefined && num > fieldDef.maximum) {
					return `Must be at most ${fieldDef.maximum}`;
				}
				break;
			}
			case 'boolean':
				// Accept true/false or convert from string
				break;
			case 'json':
				// Must parse to a JSON object or array (OBP rejects bare strings/numbers)
				if (typeof value === 'object') break;
				try {
					const parsed = JSON.parse(String(value));
					if (typeof parsed !== 'object' || parsed === null) {
						return 'Must be a JSON object or array';
					}
				} catch (e) {
					return e instanceof Error ? `Invalid JSON: ${e.message}` : 'Invalid JSON';
				}
				break;
			case 'DATE_WITH_DAY':
				if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
					return 'Must be in format YYYY-MM-DD';
				}
				break;
			default:
				// String validation
				if (fieldDef.minLength && String(value).length < fieldDef.minLength) {
					return `Must be at least ${fieldDef.minLength} characters`;
				}
				if (fieldDef.maxLength && String(value).length > fieldDef.maxLength) {
					return `Must be at most ${fieldDef.maxLength} characters`;
				}
				break;
		}
	}

	return null;
}

/**
 * Validate all fields of a record. Returns a map of field name → error
 * message, empty when everything is valid.
 */
export function validateDynamicEntityFields(
	properties: DynamicEntityProperties,
	requiredFields: string[],
	data: Record<string, unknown>
): Record<string, string> {
	const errors: Record<string, string> = {};

	Object.keys(properties).forEach((fieldName) => {
		const error = validateDynamicEntityField(
			properties[fieldName],
			requiredFields.includes(fieldName),
			data[fieldName]
		);
		if (error) {
			errors[fieldName] = error;
		}
	});

	return errors;
}

/**
 * Convert form values to the wire format the OBP dynamic entity data
 * endpoints expect. Empty values ("", null, undefined) are omitted;
 * 0 and false pass through.
 */
export function convertDynamicEntityFormData(
	properties: DynamicEntityProperties,
	data: Record<string, unknown>
): Record<string, unknown> {
	const converted: Record<string, unknown> = {};

	Object.keys(properties).forEach((fieldName) => {
		const fieldDef = properties[fieldName];
		const value = data[fieldName];

		if (value === '' || value === null || value === undefined) {
			return;
		}

		switch (fieldDef.type) {
			case 'boolean':
				// OBP expects boolean as string "true" or "false"
				converted[fieldName] = value ? 'true' : 'false';
				break;
			case 'integer':
				converted[fieldName] = Math.round(Number(value));
				break;
			case 'number':
				converted[fieldName] = Number(value);
				break;
			case 'json':
				// Parse textarea contents into a real JSON object/array. If the
				// value is already an object (e.g. loaded from an existing
				// record), pass it through unchanged.
				converted[fieldName] = typeof value === 'string' ? JSON.parse(value) : value;
				break;
			default:
				converted[fieldName] = String(value);
				break;
		}
	});

	return converted;
}

/**
 * Build the initial form values for a create form (no record) or an edit
 * form (existing record data). json fields are edited as text, so existing
 * objects/arrays are rendered as pretty-printed JSON for the textarea.
 */
export function initialDynamicEntityFormData(
	properties: DynamicEntityProperties,
	recordData?: Record<string, unknown> | null
): Record<string, unknown> {
	const formData: Record<string, unknown> = {};

	Object.keys(properties).forEach((fieldName) => {
		const rawValue = recordData ? recordData[fieldName] : '';
		if (properties[fieldName].type === 'json' && rawValue && typeof rawValue === 'object') {
			formData[fieldName] = JSON.stringify(rawValue, null, 2);
		} else {
			formData[fieldName] = rawValue;
		}
	});

	return formData;
}

/** Which HTML input to render for a dynamic entity field. */
export function dynamicEntityInputType(
	fieldDef: DynamicEntityFieldDef
): 'checkbox' | 'number' | 'textarea' | 'text' {
	switch (fieldDef.type) {
		case 'boolean':
			return 'checkbox';
		case 'integer':
		case 'number':
			return 'number';
		case 'json':
			return 'textarea';
		default:
			return 'text';
	}
}

/**
 * The wrapper key OBP-API uses for a dynamic entity list response.
 *
 * `GET /obp/dynamic-entity/<EntityName>` wraps the records as
 * `{ "<key>_list": [...] }` where the key is Lift's StringHelpers.snakify of
 * the entity name (CamelCase becomes snake_case, dashes are kept) with any
 * trailing dashes/underscores stripped before the `_list` suffix. So
 * "parcel" -> "parcel_list" but "PeronalFriends" -> "peronal_friends_list" —
 * NOT `entityName.toLowerCase() + "_list"`.
 */
export function dynamicEntityListKey(entityName: string): string {
	const snakified = entityName
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
		.replace(/([a-z\d])([A-Z])/g, '$1_$2')
		.toLowerCase();
	return snakified.replace(/[-_]*$/, '') + '_list';
}

/**
 * Extract the record array from an OBP dynamic entity list response,
 * whatever the entity is named. Tries the exact wrapper key OBP uses, then
 * legacy guesses, then falls back to the first array-valued property so an
 * unanticipated naming scheme degrades to "found the records" rather than
 * silently showing zero.
 */
export function extractDynamicEntityRecords(entityName: string, response: unknown): unknown[] {
	if (Array.isArray(response)) return response;
	if (!response || typeof response !== 'object') return [];
	const obj = response as Record<string, unknown>;

	const candidateKeys = [
		dynamicEntityListKey(entityName),
		`${entityName.toLowerCase()}_list`,
		entityName,
		'data',
		'records'
	];
	for (const key of candidateKeys) {
		if (Array.isArray(obj[key])) return obj[key] as unknown[];
	}

	const listKey = Object.keys(obj).find((k) => k.endsWith('_list') && Array.isArray(obj[k]));
	if (listKey) return obj[listKey] as unknown[];

	const arrayKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
	return arrayKey ? (obj[arrayKey] as unknown[]) : [];
}
