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
import { obp_requests } from "$lib/obp/requests";
import { dynamicEntityDefinitionsPath } from "@obp/shared/obp";

/**
 * The Dynamic Entity definition with this id in one space (a bank id, or none for the system space),
 * or null. v7.0.0 has no get-one endpoint, so this reads the space's list.
 */
export async function findDynamicEntityDefinition(
  dynamicEntityId: string,
  bankId: string | null | undefined,
  accessToken: string,
): Promise<any | null> {
  const response = await obp_requests.get(dynamicEntityDefinitionsPath(bankId), accessToken);
  const definitions: any[] = response?.dynamic_entities || [];
  return definitions.find((d) => d.dynamic_entity_id === dynamicEntityId) ?? null;
}
