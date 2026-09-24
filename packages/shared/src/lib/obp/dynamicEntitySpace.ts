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
 * The bank id of the system space in OBP's Dynamic Entities.
 *
 * Every Dynamic Entity lives in a space: a bank, or the system space, whose bank id is SYS. The
 * Roles that manage entity definitions (CanCreateDynamicEntityDefinition and its siblings) are
 * granted at the bank id of the space they cover, so a Role for the system space is held at SYS,
 * never at the empty bank id.
 */
export const DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID = "SYS";
