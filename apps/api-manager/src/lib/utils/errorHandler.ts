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
 * Error Handler Utility
 *
 * Provides consistent error extraction and formatting across the application.
 * For API Manager, we want to show FULL error details to users since this is an admin tool.
 */

export interface OBPErrorDetails {
  message: string;
  code?: string;
  status?: number;
  fullError?: any;
}

/**
 * Extracts full OBP error details from a fetch Response
 *
 * This function attempts to parse JSON error responses and extract:
 * - error.message or error.error field
 * - OBP error code (if present)
 * - HTTP status code
 * - Full error object for logging
 *
 * @param response - The fetch Response object
 * @param fallbackMessage - Default message if parsing fails
 * @returns Promise<OBPErrorDetails>
 */
export async function extractErrorFromResponse(
  response: Response,
  fallbackMessage: string = "Operation failed"
): Promise<OBPErrorDetails> {
  const details: OBPErrorDetails = {
    message: fallbackMessage,
    status: response.status,
  };

  try {
    // Try to parse JSON error response
    const errorData = await response.json();

    // Extract error message (try multiple possible fields)
    details.message =
      errorData.error ||
      errorData.message ||
      errorData.error_message ||
      fallbackMessage;

    // Extract OBP error code if present
    if (errorData.code) {
      details.code = errorData.code;
    } else if (errorData.error_code) {
      details.code = errorData.error_code;
    } else if (errorData.obpErrorCode) {
      details.code = errorData.obpErrorCode;
    }

    // Store full error for logging
    details.fullError = errorData;

  } catch (parseError) {
    // If JSON parsing fails, try to get text response
    try {
      const text = await response.text();
      if (text) {
        details.message = `${fallbackMessage} (${response.status} ${response.statusText}): ${text}`;
      } else {
        details.message = `${fallbackMessage}: ${response.status} ${response.statusText}`;
      }
    } catch (textError) {
      // If even text parsing fails, use status info
      details.message = `${fallbackMessage}: ${response.status} ${response.statusText}`;
    }
  }

  return details;
}

/**
 * Extracts error message from a caught exception
 *
 * @param error - The caught error/exception
 * @param fallbackMessage - Default message if extraction fails
 * @returns string - The error message
 */
export function extractErrorMessage(
  error: unknown,
  fallbackMessage: string = "An error occurred"
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const err = error as any;
    return err.message || err.error || err.error_message || fallbackMessage;
  }

  return fallbackMessage;
}

/**
 * Formats error details for display to user
 *
 * @param details - OBPErrorDetails object
 * @returns string - Formatted error message
 */
export function formatErrorForDisplay(details: OBPErrorDetails): string {
  return details.message;
}

/**
 * Logs error details to console with full information
 *
 * @param context - Context string (e.g., "Delete User", "Create Entity")
 * @param details - OBPErrorDetails object
 */
export function logErrorDetails(context: string, details: OBPErrorDetails): void {
  console.error(`[${context}] Error occurred:`);
  console.error(`  Message: ${details.message}`);
  if (details.code) {
    console.error(`  Code: ${details.code}`);
  }
  if (details.status) {
    console.error(`  Status: ${details.status}`);
  }
  if (details.fullError) {
    console.error(`  Full Error:`, details.fullError);
  }
}

/**
 * Complete error handler for fetch operations
 * Extracts error, logs it, and returns formatted message
 *
 * @param response - The fetch Response object
 * @param context - Context string for logging
 * @param fallbackMessage - Default message if parsing fails
 * @returns Promise<string> - Formatted error message ready to display
 */
export async function handleFetchError(
  response: Response,
  context: string,
  fallbackMessage: string = "Operation failed"
): Promise<string> {
  const details = await extractErrorFromResponse(response, fallbackMessage);
  logErrorDetails(context, details);
  return formatErrorForDisplay(details);
}

/**
 * Wrapper for fetch calls with automatic error handling
 *
 * Usage:
 * ```typescript
 * const result = await fetchWithErrorHandling(
 *   '/api/endpoint',
 *   { method: 'POST', body: JSON.stringify(data) },
 *   'Create Record'
 * );
 *
 * if (result.success) {
 *   // Use result.data
 * } else {
 *   // Show result.error to user
 * }
 * ```
 */
export async function fetchWithErrorHandling<T = any>(
  url: string,
  options: RequestInit,
  context: string
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorMessage = await handleFetchError(response, context);
      return { success: false, error: errorMessage };
    }

    const data = await response.json();
    return { success: true, data };

  } catch (error) {
    const errorMessage = extractErrorMessage(error, "Network error occurred");
    console.error(`[${context}] Exception:`, error);
    return { success: false, error: errorMessage };
  }
}
