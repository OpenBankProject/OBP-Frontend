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
 * The personal dynamic entities the apps record Opey conversations into, one per app.
 * Both definitions live here so the API Manager, whose consumer holds
 * CanCreateSystemLevelDynamicEntity, can bootstrap both at startup (as it does for
 * obp_portal_page); each app records into its own. Rows are written as the logged-in
 * User and appear under My Data.
 */
import PORTAL from './data/portalOpeyConversationEntity.json';
import MANAGER from './data/managerOpeyConversationEntity.json';

export const PORTAL_OPEY_CONVERSATION_ENTITY = PORTAL;
export const MANAGER_OPEY_CONVERSATION_ENTITY = MANAGER;
export const PORTAL_OPEY_CONVERSATION_ENTITY_NAME: string = PORTAL.entity_name;
export const MANAGER_OPEY_CONVERSATION_ENTITY_NAME: string = MANAGER.entity_name;
