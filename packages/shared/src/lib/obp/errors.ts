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
export class OBPErrorBase extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OBPError';
        Object.setPrototypeOf(this, OBPErrorBase.prototype);
    }
}

export class OBPRateLimitError extends OBPErrorBase {
    retryAfterSeconds?: number;

    constructor(message: string, retryAfterSeconds?: number) {
        super(message);
        this.name = 'OBPRateLimitError';
        this.retryAfterSeconds = retryAfterSeconds;
        Object.setPrototypeOf(this, OBPRateLimitError.prototype);
    }
}

export class OBPTimeoutError extends OBPErrorBase {
    constructor(url: string, timeoutMs: number) {
        super(`Request to ${url} timed out after ${timeoutMs}ms`);
        this.name = 'OBPTimeoutError';
        Object.setPrototypeOf(this, OBPTimeoutError.prototype);
    }
}

export class OBPRequestError extends OBPErrorBase {
    code: string
    message: string;
    obpErrorCode: string;

    constructor(code: number, message: string) {
        super(message);
        this.name = 'OBPRequestError';
        this.code = code.toString();
        this.message = message;
        Object.setPrototypeOf(this, OBPRequestError.prototype);
        this.obpErrorCode = this.getObpErrorCode();
    }

    getObpErrorCode(): string {
        const match = this.message.match(/OBP-\d+/);
        return match ? match[0] : 'UNKNOWN_ERROR';
    }
}

export function obpErrorResponse(err: unknown, fallbackStatus: number = 500) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as any)?.statusCode || fallbackStatus;
    return {
        body: { message, code: status },
        status: status as number,
    };
}