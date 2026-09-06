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
export interface OBPConsent {
  consent_reference_id: string;
  consent_id: string;
  consumer_id: string;
  created_by_user_id: string;
  status: string;
  created_date?: string;
  last_action_date: string;
  last_usage_date: string;
  everything?: boolean;
  jwt: string;
  jwt_payload: {
    createdByUserId: string;
    sub: string;
    iss: string;
    aud: string;
    jti: string;
    iat: number;
    nbf: number;
    exp: number;
    request_headers: any[];
    entitlements: any[];
    views: any[];
  };
  api_standard: string;
  api_version: string;
}

export interface OBPConsentInfo {
  consent_id: string;
  consumer_id: string;
  created_by_user_id: string;
  last_action_date: string;
  last_usage_date: string;
  status: string;
  api_standard: string;
  api_version: string;
}

export interface OBPConsumer {
  consumer_id: string;
  key?: string;
  secret?: string;
  app_name: string;
  app_type: "public" | "confidential";
  description: string;
  developer_email: string;
  redirect_url: string;
  company: string;
  created_by_user_id: string;
  created_by_user: {
    user_id: string;
    email: string;
    provider_id: string;
    provider: string;
    username: string;
  };
  enabled: boolean;
  created: string;
}

export interface OBPConsumerRequestBody {
  app_type: "public" | "confidential";
  app_name: string;
  redirect_url: string;
  developer_email: string;
  description: string;
  company: string;
  enabled: boolean;
}

export interface OBPUserRegistrationRequestBody {
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  // v7.0.0: optional; same regex as OBP's InvalidPhoneNumber check
  mobile_phone_number?: string;
}

export interface OBPAddEntitlementBody {
  role_name: string;
  bank_id?: string;
}

export interface OBPWebUIProp {
  web_ui_props_id: string;
  name: string;
  value: string;
  description?: string;
  is_active?: boolean;
  source?: string;
}

export interface OBPWebUIPropsResponse {
  webui_props: OBPWebUIProp[];
}

export interface OBPWebUIPropRequestBody {
  name: string;
  value: string;
}

export interface OBPChatRoom {
  chat_room_id: string;
  bank_id: string;
  name: string;
  description: string;
  joining_key: string;
  created_by: string;
  created_by_username: string;
  created_by_provider: string;
  is_open_room: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface OBPChatRoomParticipant {
  participant_id: string;
  chat_room_id: string;
  user_id: string;
  username: string;
  provider: string;
  consumer_id: string;
  consumer_name: string;
  permissions: string[];
  webhook_url: string;
  joined_at: string;
  last_read_at: string;
  is_muted: boolean;
}

/**
 * A scheduler job-lock row from the `jobscheduler` table.
 * GET /obp/v7.0.0/management/system/scheduler/job-locks
 */
export interface OBPSchedulerJob {
  job_id: string;
  name: string;
  api_instance_id: string;
  started_at: string;
  age_seconds: number;
}

export interface OBPSchedulerJobsResponse {
  jobs: OBPSchedulerJob[];
  count: number;
}
