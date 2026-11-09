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
import { env as publicEnv } from '$env/dynamic/public';
import { createChatProxyHandler } from '@obp/shared/server/chat';
import { cohortSpace } from '$lib/server/space';
import type { RequestHandler } from './$types';

/**
 * The discussion pages' calls from the browser (messages, reactions, read markers), with the User's own token. Only
 * the chat paths of Cohort's rooms pass: Cohort has no general OBP proxy.
 */
const handle: RequestHandler = (event) => createChatProxyHandler(publicEnv.PUBLIC_OBP_BASE_URL ?? '', { kind: 'bank', bankId: cohortSpace() })(event);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
