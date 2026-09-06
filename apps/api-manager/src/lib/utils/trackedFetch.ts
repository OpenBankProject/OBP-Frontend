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
 * trackedFetch.ts
 *
 * A wrapper around the native fetch API that automatically tracks API activity
 * using the apiActivity store. This ensures the ApiActivityIndicator shows
 * whenever API calls are in progress.
 *
 * Usage:
 *   import { trackedFetch } from '$lib/utils/trackedFetch';
 *
 *   // Use exactly like fetch
 *   const response = await trackedFetch('/api/endpoint', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(data)
 *   });
 */

import { apiActivity } from '$lib/stores/apiActivity';

/**
 * A fetch wrapper that automatically tracks API activity.
 *
 * @param input - The resource URL or Request object
 * @param init - Optional fetch configuration
 * @returns Promise<Response> - The fetch response
 */
export async function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  apiActivity.startCall();

  try {
    const response = await fetch(input, init);
    return response;
  } finally {
    apiActivity.endCall();
  }
}

/**
 * Helper function to wrap multiple sequential fetch calls in a single activity tracking scope.
 * Useful when you want to track a series of related API calls as one operation.
 *
 * @param fn - An async function containing fetch calls
 * @returns Promise<T> - The result of the function
 *
 * @example
 * await trackApiActivity(async () => {
 *   const user = await fetch('/api/user').then(r => r.json());
 *   const profile = await fetch(`/api/profile/${user.id}`).then(r => r.json());
 *   return { user, profile };
 * });
 */
export async function trackApiActivity<T>(fn: () => Promise<T>): Promise<T> {
  apiActivity.startCall();

  try {
    return await fn();
  } finally {
    apiActivity.endCall();
  }
}
