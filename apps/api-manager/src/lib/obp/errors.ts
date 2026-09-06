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
 * Extract error details from a caught exception.
 * IMPORTANT: Never simplify or hide OBP error messages - show them in full!
 *
 * @param err - The caught error
 * @returns Object with error message and optional OBP error code
 */
export function extractErrorDetails(err: unknown): {
  message: string;
  obpErrorCode?: string;
} {
  if (err instanceof Error) {
    const result: { message: string; obpErrorCode?: string } = {
      message: err.message,
    };
    // Check if it's an OBPRequestError with obpErrorCode property
    if ("obpErrorCode" in err) {
      result.obpErrorCode = (err as any).obpErrorCode;
    }
    return result;
  }

  if (typeof err === "string") {
    return { message: err };
  }

  if (err && typeof err === "object") {
    if ((err as any).message) {
      return { message: (err as any).message };
    }
    return { message: JSON.stringify(err) };
  }

  return { message: String(err) };
}

/**
 * Build a JSON error response matching the OBP API ErrorMessage format:
 * { message: string, code: number } where code is the HTTP status code.
 */
export function obpErrorResponse(err: unknown, fallbackStatus: number = 500) {
  const { message } = extractErrorDetails(err);
  const status = (err as any)?.statusCode || fallbackStatus;
  return {
    body: { message, code: status },
    status: status as number,
  };
}

export class OBPErrorBase extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "OBPError";
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, OBPErrorBase.prototype);
  }
}

export class OBPRequestError extends OBPErrorBase {
  code: string;
  message: string;
  obpErrorCode: string;

  constructor(code: string | number, message: string, statusCode?: number) {
    super(message, statusCode);
    this.name = "OBPRequestError";
    this.code = String(code);
    this.message = message;
    Object.setPrototypeOf(this, OBPRequestError.prototype);
    this.obpErrorCode = this.getObpErrorCode();
  }

  getObpErrorCode(): string {
    // Try to extract OBP error code from message first
    const messageMatch = this.message.match(/OBP-\d+/);
    if (messageMatch) {
      return messageMatch[0];
    }
    // If code looks like an OBP code, use it
    if (this.code && this.code.match(/^OBP-\d+$/)) {
      return this.code;
    }
    return "UNKNOWN_ERROR";
  }
}
