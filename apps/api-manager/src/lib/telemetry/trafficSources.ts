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
 * This module describes GET /obp/v7.0.0/management/traffic/top-callers, which shows where the
 * traffic on the OBP-API instance that answered is coming from, and formats it for the Telemetry
 * page.
 *
 * The counts are estimates from fixed-size tables (the Space-Saving algorithm of Metwally, Agrawal
 * and El Abbadi, ICDT 2005): `requests` is within `error` of the true count.
 */

export interface TrafficConsumer {
  consumer_id: string;
  application_name: string;
  requests: number;
  error: number;
  status_2xx: number;
  status_4xx: number;
  status_5xx: number;
  refused: number;
  unmatched: number;
  endpoints: string[];
  last_ip_address: string;
  first_seen: string;
  last_seen: string;
}

export interface TrafficAddress {
  ip_address: string;
  requests: number;
  error: number;
  status_2xx: number;
  status_4xx: number;
  status_5xx: number;
  refused: number;
  unmatched: number;
  endpoints: string[];
  consumer_ids: string[];
  first_seen: string;
  last_seen: string;
}

export interface TrafficCallerEndpoint {
  caller_kind: "consumer" | "ip";
  caller: string;
  endpoint: string;
  api_version?: string | null;
  requests: number;
  error: number;
  status_2xx: number;
  status_4xx: number;
  status_5xx: number;
  refused: number;
  mean_duration_ms: number;
  max_duration_ms: number;
  last_seen: string;
}

export interface TrafficSources {
  api_instance_id: string;
  window_minutes: number;
  consumers: TrafficConsumer[];
  addresses: TrafficAddress[];
  callers_and_endpoints: TrafficCallerEndpoint[];
}

export const TRAFFIC_WINDOWS = [1, 5, 15] as const;

/** "12,400" when exact, "12,400 ±300" when the count is an estimate. */
export function formatEstimate(requests: number, error: number): string {
  const count = Math.round(requests).toLocaleString();
  return error > 0 ? `${count} ±${Math.round(error).toLocaleString()}` : count;
}

/**
 * The share of a caller's tracked responses that were 4xx, 0 to 1. A scanner is mostly 4xx
 * (unknown paths, bad parameters); a working integration mostly 2xx. Null when nothing was tracked.
 */
export function clientErrorShare(row: { status_2xx: number; status_4xx: number; status_5xx: number }): number | null {
  const tracked = row.status_2xx + row.status_4xx + row.status_5xx;
  return tracked > 0 ? row.status_4xx / tracked : null;
}

/** The rate-limiting page with the IP penalty form filled in for this address. */
export function penaliseHref(ipAddress: string): string {
  return `/system/rate-limiting?${new URLSearchParams({ penalise: ipAddress }).toString()}#ip-penalties`;
}
