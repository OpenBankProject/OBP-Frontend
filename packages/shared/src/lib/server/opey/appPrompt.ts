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
import { readFileSync } from 'node:fs';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('OpeyAppPrompt');

/**
 * An app's own focus for Opey, from its environment: the file named by OPEY_APP_SUPPLEMENTARY_PROMPT_FILE (e.g. a
 * mounted ConfigMap; it wins when readable and not empty), else OPEY_APP_SUPPLEMENTARY_PROMPT, else ''. Meant to be
 * called per message (as the proxy's appSupplementaryPrompt), so a change needs no restart.
 */
export function appSupplementaryPromptFromEnv(env: Record<string, string | undefined>): string {
	const file = env.OPEY_APP_SUPPLEMENTARY_PROMPT_FILE?.trim();
	if (file) {
		try {
			const text = readFileSync(file, 'utf8').trim();
			if (text) return text;
		} catch (err) {
			logger.warn(`Could not read OPEY_APP_SUPPLEMENTARY_PROMPT_FILE=${file}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	return env.OPEY_APP_SUPPLEMENTARY_PROMPT?.trim() ?? '';
}
