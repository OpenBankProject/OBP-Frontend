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
import { chatPolicy, type ChatPagesConfig } from '@obp/shared/server/chat';
import { obpRequests } from './obp';
import { cohortSpace } from './space';

/**
 * Cohort's discussions: chat rooms at Cohort's own bank_id, separate from the Portal's system-wide rooms, at
 * /discussions. Anyone logged in may create a room and invite others with its join link; no Role is needed. The pages
 * themselves are shared with the Portal (@obp/shared/server/chat).
 */
export const cohortChat = (): ChatPagesConfig => ({ scope: { kind: 'bank', bankId: cohortSpace() }, obp: obpRequests, basePath: '/discussions' });

/** The links that stay clickable in messages: Cohort's own services, and OBP-API's list (or the default). */
export const cohortChatPolicy = chatPolicy(obpRequests, () => [publicEnv.PUBLIC_OBP_BASE_URL, publicEnv.PUBLIC_OPEY_BASE_URL]);
