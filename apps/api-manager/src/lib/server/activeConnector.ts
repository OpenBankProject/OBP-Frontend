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
 * Which connector this OBP instance actually runs, so a page about connectors can say so.
 *
 * The `connector` prop comes from GET /obp/v6.0.0/management/config-props, which needs a logged-in
 * user and no role. When it is `star` there is no single answer: star resolves every connector
 * method through the Method Routings table and falls back to `mapped` for anything unrouted
 * (Connector.getConnectorNameAndMethodRouting in OBP-API), so the effective set is the connectors
 * named in those routings plus mapped. Reading the routings needs CanGetMethodRoutings, so that
 * part degrades on its own.
 */
import { createLogger } from "@obp/shared/utils";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("ActiveConnector");

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes: the prop only changes on a restart, routings can change
const CONFIG_PROPS_PATH = "/obp/v6.0.0/management/config-props";
const METHOD_ROUTINGS_PATH = "/obp/v3.1.0/management/method_routings";

/** The connector star falls back to when no Method Routing matches a method. */
export const STAR_FALLBACK_CONNECTOR = "mapped";

export interface ActiveConnector {
  /** The `connector` prop verbatim, or null when it could not be read. */
  prop: string | null;
  /** True when the prop is `star`, so routing is per method rather than one connector. */
  isStar: boolean;
  /** Connectors named in the Method Routings, most-routed first. Only meaningful for star. */
  delegates: { name: string; routings: number }[];
  /** Every connector actually reachable: the prop, or star's delegates plus the fallback. */
  effective: string[];
  /** Why the answer is incomplete, for the page to show honestly rather than guess. */
  warnings: string[];
}

interface Cached {
  value: ActiveConnector;
  fetchedAt: number;
}

let cache: Cached | null = null;
let inFlight: Promise<ActiveConnector> | null = null;

async function readConnectorProp(token: string): Promise<string | null> {
  const resp = await obp_requests.get(CONFIG_PROPS_PATH, token);
  // ConfigPropJsonV600 is (name, value) — not (key, value), as the /system/config-props page shows.
  const props = (resp?.config_props ?? []) as { name?: string; value?: string }[];
  const entry = props.find((p) => p.name === "connector");
  const value = entry?.value?.trim();
  // Props whose key or value looks sensitive come back as "****"; connector is not one of those,
  // but treat a masked value as unknown rather than reporting a connector called "****".
  return !value || value === "****" ? null : value;
}

async function readRoutingConnectors(token: string): Promise<{ name: string; routings: number }[]> {
  const resp = await obp_requests.get(METHOD_ROUTINGS_PATH, token);
  const routings = (resp?.method_routings ?? []) as { connector_name?: string }[];
  const counts = new Map<string, number>();
  for (const r of routings) {
    const name = r.connector_name?.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, routings]) => ({ name, routings }))
    .sort((a, b) => b.routings - a.routings || a.name.localeCompare(b.name));
}

async function resolve(token: string): Promise<ActiveConnector> {
  const warnings: string[] = [];
  let prop: string | null = null;
  try {
    prop = await readConnectorProp(token);
    if (!prop) warnings.push("OBP did not report a `connector` property, so the active connector is unknown.");
  } catch (e) {
    logger.warn("Could not read the connector prop from config-props:", e);
    warnings.push(`Could not read the \`connector\` property from OBP: ${e instanceof Error ? e.message : String(e)}`);
  }

  const isStar = prop === "star";
  let delegates: { name: string; routings: number }[] = [];
  if (isStar) {
    try {
      delegates = await readRoutingConnectors(token);
    } catch (e) {
      logger.warn("Could not read the method routings:", e);
      warnings.push(
        `The star connector routes per method, but the Method Routings could not be read (this needs CanGetMethodRoutings): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const effective = isStar
    ? [...new Set([...delegates.map((d) => d.name), STAR_FALLBACK_CONNECTOR])]
    : prop
      ? [prop]
      : [];

  return { prop, isStar, delegates, effective, warnings };
}

/** Best effort: never throws, so a page can show what it knows and say what it does not. */
export async function loadActiveConnector(token: string, force = false): Promise<ActiveConnector> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_DURATION) return cache.value;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const value = await resolve(token);
      cache = { value, fetchedAt: Date.now() };
      return value;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
