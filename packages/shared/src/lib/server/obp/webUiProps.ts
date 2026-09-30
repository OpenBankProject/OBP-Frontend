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
 * Reads the active OBP webui_props (database rows, then `webui_*` lines from the
 * OBP props file) through the anonymous `GET /obp/v6.0.0/webui-props`.
 *
 * One fetch serves every prop; the result is cached in-process so public pages
 * do not call OBP on each load. If OBP is unreachable the last good values are
 * served, or none, and callers fall back to their env var / default.
 */

import { createLogger } from '$shared/utils/logger';
import { webUiPropNameForEnvVar } from '$shared/config/webUiProps';
import type { ObpGet } from './consentsConfig.js';

const logger = createLogger('WebUiProps');

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { values: Map<string, string>; fetchedAt: number } | null = null;

export async function getActiveWebUiProps(obpGet: ObpGet): Promise<Map<string, string>> {
	if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.values;

	try {
		const json = await obpGet('/obp/v6.0.0/webui-props?what=active');
		const values = new Map<string, string>();
		for (const prop of json?.webui_props ?? []) {
			if (typeof prop?.name === 'string' && typeof prop?.value === 'string') {
				values.set(prop.name, prop.value);
			}
		}
		cache = { values, fetchedAt: Date.now() };
		return values;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.warn(`Could not fetch webui_props, using ${cache ? 'cached values' : 'fallbacks'}: ${msg}`);
		if (cache) {
			// Retry after another TTL rather than on every request while OBP is down
			cache = { values: cache.values, fetchedAt: Date.now() };
			return cache.values;
		}
		return new Map();
	}
}

export type WebUiValueSource = 'webui_prop' | 'env' | 'default';

export interface ResolvedWebUiValue {
	value: string;
	source: WebUiValueSource;
	webUiPropName: string;
	envVar: string;
}

/**
 * Resolve settings that can come from a webui_prop, an env var, or a default —
 * in that order. The webui_prop name is derived from the env var
 * (`PUBLIC_WELCOME_TITLE` → `webui_welcome_title`). Blank values fall through.
 *
 *   const text = await resolveWebUiValues(get, publicEnv, {
 *     title: { envVar: 'PUBLIC_WELCOME_TITLE', default: 'Welcome!' }
 *   });
 *   text.title.value
 */
export async function resolveWebUiValues<K extends string>(
	obpGet: ObpGet,
	env: Record<string, string | undefined>,
	settings: Record<K, { envVar: string; default: string }>
): Promise<Record<K, ResolvedWebUiValue>> {
	const props = await getActiveWebUiProps(obpGet);
	const resolved = {} as Record<K, ResolvedWebUiValue>;
	for (const key of Object.keys(settings) as K[]) {
		const { envVar, default: fallback } = settings[key];
		const webUiPropName = webUiPropNameForEnvVar(envVar);
		const fromProp = props.get(webUiPropName);
		const fromEnv = env[envVar];
		const [value, source]: [string, WebUiValueSource] = fromProp?.trim()
			? [fromProp, 'webui_prop']
			: fromEnv?.trim()
				? [fromEnv, 'env']
				: [fallback, 'default'];
		resolved[key] = { value, source, webUiPropName, envVar };
	}
	return resolved;
}

/** For tests. */
export function _resetWebUiPropsCache(): void {
	cache = null;
}
