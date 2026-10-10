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
import { format } from 'util';

// The app's recent log lines, kept in memory per level as OBP-API keeps its log cache, so a monitor
// such as OBP-Sentinel can read them through GET /monitoring/log-cache/LEVEL in the same shape.
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warning', 'error'] as const;
export type LogCacheLevel = (typeof LOG_LEVELS)[number];

export interface LogTailEntry {
	level: string;
	message: string;
	timestamp: number;
}

const MAX_PER_LEVEL = 1000;
const MAX_MESSAGE_LENGTH = 4000;

const byLevel = new Map<LogCacheLevel, LogTailEntry[]>(LOG_LEVELS.map((level) => [level, []]));
const everyLevel: LogTailEntry[] = [];

function keep(entries: LogTailEntry[], entry: LogTailEntry, max: number): void {
	entries.unshift(entry); // newest first, as OBP-API returns them
	if (entries.length > max) entries.length = max;
}

export function record(level: LogCacheLevel, message: string, now: number = Date.now()): void {
	const entry = {
		level: level.toUpperCase(),
		message: message.slice(0, MAX_MESSAGE_LENGTH),
		timestamp: now
	};
	keep(byLevel.get(level)!, entry, MAX_PER_LEVEL);
	keep(everyLevel, entry, MAX_PER_LEVEL * LOG_LEVELS.length);
}

/** The kept lines of one level, or of every level, newest first. */
export function logTail(
	level: LogCacheLevel | 'all',
	limit?: number,
	offset?: number
): { entries: LogTailEntry[] } {
	const entries = level === 'all' ? everyLevel : byLevel.get(level)!;
	const start = offset ?? 0;
	return { entries: entries.slice(start, limit === undefined ? undefined : start + limit) };
}

export function clearLogCache(): void {
	byLevel.forEach((entries) => (entries.length = 0));
	everyLevel.length = 0;
}

const CONSOLE_LEVELS: [keyof Console, LogCacheLevel][] = [
	['trace', 'trace'],
	['debug', 'debug'],
	['log', 'info'],
	['info', 'info'],
	['warn', 'warning'],
	['error', 'error']
];

let capturing = false;

/** Keep everything written through console (and so through createLogger), as well as writing it as before. */
export function captureConsole(): void {
	if (capturing) return;
	capturing = true;
	for (const [method, level] of CONSOLE_LEVELS) {
		const original = (console[method] as (...args: unknown[]) => void).bind(console);
		(console as any)[method] = (...args: unknown[]) => {
			try {
				record(level, format(...args));
			} catch {
				// never let keeping a line break the logging itself
			}
			original(...args);
		};
	}
}
