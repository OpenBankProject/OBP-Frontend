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

/** A refusal while starting an Opey session; `statusCode` is what the auth route answers with. */
export class OpeyAuthError extends Error {
	statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.name = 'OpeyAuthError';
		this.statusCode = statusCode;
	}
}

/** The status the auth route returns for an Opey answer: a client error is passed on, anything else is a bad gateway. */
export function statusForOpeyAnswer(opeyStatus: number): number {
	return opeyStatus >= 400 && opeyStatus < 500 ? opeyStatus : 502;
}

/** A 4xx other than request timeout / rate limit will answer the same way next time, so it is not retried. */
export function isRetryableStatus(status: number | undefined): boolean {
	if (status === undefined) return true;
	if (status === 408 || status === 429) return true;
	return !(status >= 400 && status < 500);
}
