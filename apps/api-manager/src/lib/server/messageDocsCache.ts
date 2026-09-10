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
 * Message Docs: the messages OBP sends to a Core Banking / Payment adapter over a given connector,
 * from GET /obp/v2.2.0/message-docs/CONNECTOR — with an example outbound message, the expected
 * inbound response, and which endpoints depend on each message.
 *
 * They are connector metadata compiled into the API, so they only move on a redeploy: unlike the
 * Glossary this can be cached on time alone. Each connector's payload is several hundred KB, so
 * pages take an index from here and the full message only for the one they show.
 */
import { createLogger } from "@obp/shared/utils";
import { obp_requests } from "$lib/obp/requests";
import { apiExplorerBaseUrl } from "$lib/server/glossaryCache";

const logger = createLogger("MessageDocsCache");

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes: message docs change only when OBP is redeployed

/**
 * The connectors OBP can serve message docs for, from Connector.nameToConnector in OBP-API.
 * `proxy` is test-only and `star`/`internal` publish none, so they are not offered. A connector
 * that publishes nothing on this instance is kept — the page says so rather than hiding it.
 */
export const MESSAGE_DOC_CONNECTORS = [
  { name: "rest_vMar2019", label: "REST (Mar 2019)" },
  { name: "grpc_vFeb2026", label: "gRPC (Feb 2026)" },
  { name: "rabbitmq_vOct2024", label: "RabbitMQ (Oct 2024)" },
  { name: "stored_procedure_vDec2019", label: "Stored Procedure (Dec 2019)" },
  { name: "akka_vDec2018", label: "Akka (Dec 2018)" },
  { name: "cardano_vJun2025", label: "Cardano (Jun 2025)" },
  { name: "ethereum_vSept2025", label: "Ethereum (Sept 2025)" },
  { name: "mapped", label: "Mapped (local database)" },
] as const;

export const DEFAULT_CONNECTOR = "rest_vMar2019";

export function isKnownConnector(name: string): boolean {
  return MESSAGE_DOC_CONNECTORS.some((c) => c.name === name);
}

export function connectorLabel(name: string): string {
  return MESSAGE_DOC_CONNECTORS.find((c) => c.name === name)?.label ?? name;
}

/** One message doc as v2.2.0 returns it. */
export interface MessageDoc {
  process: string;
  message_format: string;
  description: string;
  example_outbound_message: unknown;
  example_inbound_message: unknown;
  adapter_implementation: { group?: string; suggested_order?: number };
  dependent_endpoints: unknown[];
  requiredFieldInfo: Record<string, unknown>;
}

/** A row for the list: enough to find a message, none of the example payloads. */
export interface MessageDocIndexRow {
  process: string;
  description: string;
  message_format: string;
  group: string;
  suggested_order: number | null;
  dependent_endpoint_count: number;
  required_field_count: number;
}

interface ConnectorCache {
  /** Process to doc, first occurrence winning. */
  byProcess: Map<string, MessageDoc>;
  /** Processes served more than once, so a keyed list can never see a duplicate. */
  duplicateProcesses: string[];
  fetchedAt: number;
}

const caches = new Map<string, ConnectorCache>();
const inFlight = new Map<string, Promise<ConnectorCache>>();

function indexDocs(docs: MessageDoc[]): ConnectorCache {
  const byProcess = new Map<string, MessageDoc>();
  const duplicateProcesses: string[] = [];
  for (const doc of docs) {
    if (byProcess.has(doc.process)) {
      duplicateProcesses.push(doc.process);
      continue;
    }
    byProcess.set(doc.process, doc);
  }
  return { byProcess, duplicateProcesses, fetchedAt: Date.now() };
}

async function fetchConnector(accessToken: string, connector: string, force: boolean): Promise<ConnectorCache> {
  const cached = caches.get(connector);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_DURATION) return cached;
  const existing = inFlight.get(connector);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const resp = await obp_requests.get(`/obp/v2.2.0/message-docs/${encodeURIComponent(connector)}`, accessToken);
      const docs = (resp?.message_docs ?? []) as MessageDoc[];
      const state = indexDocs(docs);
      caches.set(connector, state);
      logger.info(`Cached ${state.byProcess.size} message docs for ${connector}`);
      return state;
    } finally {
      inFlight.delete(connector);
    }
  })();
  inFlight.set(connector, promise);
  return promise;
}

/** Every message the connector documents, ordered as the adapter is meant to implement them. */
export async function loadMessageDocIndex(
  accessToken: string,
  connector: string,
  force = false,
): Promise<{ rows: MessageDocIndexRow[]; duplicateProcesses: string[] }> {
  const state = await fetchConnector(accessToken, connector, force);
  const rows = [...state.byProcess.values()]
    .map((d) => ({
      process: d.process,
      description: d.description ?? "",
      message_format: d.message_format ?? "",
      group: (d.adapter_implementation?.group ?? "").replace(/^-\s*/, ""),
      suggested_order: d.adapter_implementation?.suggested_order ?? null,
      dependent_endpoint_count: Array.isArray(d.dependent_endpoints) ? d.dependent_endpoints.length : 0,
      required_field_count: Object.keys(d.requiredFieldInfo ?? {}).length,
    }))
    // suggested_order is the order an adapter author is meant to work through, so lead with it.
    .sort(
      (a, b) =>
        (a.suggested_order ?? Number.MAX_SAFE_INTEGER) - (b.suggested_order ?? Number.MAX_SAFE_INTEGER) ||
        a.process.localeCompare(b.process),
    );
  return { rows, duplicateProcesses: state.duplicateProcesses };
}

/** One message doc in full. Undefined when this connector documents no such process. */
export async function loadMessageDoc(
  accessToken: string,
  connector: string,
  process: string,
  force = false,
): Promise<MessageDoc | undefined> {
  const state = await fetchConnector(accessToken, connector, force);
  return state.byProcess.get(process);
}

/** The API Explorer's Message Docs page for a connector, optionally anchored on one process. */
export function explorerMessageDocsUrl(connector: string, process?: string): string {
  const base = `${apiExplorerBaseUrl()}/message-docs/${encodeURIComponent(connector)}`;
  return process ? `${base}#${process}` : base;
}
