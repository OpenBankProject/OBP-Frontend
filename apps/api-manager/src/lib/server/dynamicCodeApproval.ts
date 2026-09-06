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
import { createLogger } from "@obp/shared/utils";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("DynamicCodeApproval");

/** GET /obp/v7.0.0/management/dynamic-code-approval-config, as OBP returns it. */
export interface DynamicCodeApprovalConfig {
  dynamic_code_execution_enabled: boolean;
  requires_approval: boolean;
  target_types: string[];
  delete_requires_approval: boolean;
  request_ttl_hours: number;
  approval_role: string;
}

/**
 * What a page needs to know about maker/checker for one target type.
 * `known` is false when OBP could not be asked (older OBP, network error), so the
 * page can say "unknown" instead of guessing.
 */
export interface DynamicCodeApprovalStatus {
  known: boolean;
  /** allow_user_generated_scala_code: when false every create/update fails with OBP-50020. */
  executionEnabled: boolean;
  requiresApproval: boolean;
  deleteRequiresApproval: boolean;
  requestTtlHours: number;
  approvalRole: string;
  targetTypes: string[];
  error?: string;
}

export const DYNAMIC_CODE_APPROVAL_CONFIG_PATH = "/obp/v7.0.0/management/dynamic-code-approval-config";

/** Ask OBP whether writes to `targetType` are queued for approval. Never throws. */
export async function loadDynamicCodeApprovalConfig(
  accessToken: string,
  targetType = "DYNAMIC_RESOURCE_DOC",
): Promise<DynamicCodeApprovalStatus> {
  try {
    const cfg = (await obp_requests.get(DYNAMIC_CODE_APPROVAL_CONFIG_PATH, accessToken)) as DynamicCodeApprovalConfig;
    const managed = !!cfg?.requires_approval && (cfg.target_types ?? []).includes(targetType);
    return {
      known: true,
      executionEnabled: cfg?.dynamic_code_execution_enabled !== false,
      requiresApproval: managed,
      deleteRequiresApproval: managed && !!cfg.delete_requires_approval,
      requestTtlHours: Number(cfg?.request_ttl_hours ?? 0),
      approvalRole: cfg?.approval_role || "CanApproveDynamicChangeRequest",
      targetTypes: cfg?.target_types ?? [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("Could not read the dynamic code approval config from OBP:", message);
    return {
      known: false,
      executionEnabled: true,
      requiresApproval: false,
      deleteRequiresApproval: false,
      requestTtlHours: 0,
      approvalRole: "CanApproveDynamicChangeRequest",
      targetTypes: [],
      error: message,
    };
  }
}
