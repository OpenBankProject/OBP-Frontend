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
 * Message docs per connector, cached per process.
 *
 * A connector's message docs describe every call OBP makes *outwards* to a core banking
 * adapter — the other half of the API. They change only when OBP-API is redeployed, and a
 * connector's set is large (the REST connector is ~700 KB), so each is fetched whole and
 * kept.
 *
 * Lifted out of the API Manager so the Portal's API Explorer serves the same docs.
 * Readable anonymously, so `token` is optional.
 */
import { createLogger } from '$shared/utils/logger';
import type { ObpGetter } from './apiVersions.js';

const logger = createLogger('MessageDocsCache');

const CACHE_DURATION = 30 * 60 * 1000;

/**
 * The connectors OBP can serve message docs for, from Connector.nameToConnector in
 * OBP-API. `proxy` is test-only and `star`/`internal` publish none, so they are not
 * offered. A connector that publishes nothing on this instance is kept — the page says so
 * rather than hiding it.
 */
export const MESSAGE_DOC_CONNECTORS = [
	{ name: 'rest_vMar2019', label: 'REST (Mar 2019)' },
	{ name: 'grpc_vFeb2026', label: 'gRPC (Feb 2026)' },
	{ name: 'rabbitmq_vOct2024', label: 'RabbitMQ (Oct 2024)' },
	{ name: 'stored_procedure_vDec2019', label: 'Stored Procedure (Dec 2019)' },
	{ name: 'akka_vDec2018', label: 'Akka (Dec 2018)' },
	{ name: 'cardano_vJun2025', label: 'Cardano (Jun 2025)' },
	{ name: 'ethereum_vSept2025', label: 'Ethereum (Sept 2025)' },
	{ name: 'mapped', label: 'Mapped (local database)' }
] as const;

export const DEFAULT_CONNECTOR = 'rest_vMar2019';

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
	/** Always 0 on current OBP builds, but rendered when present rather than assumed dead. */
	dependent_endpoint_count: number;
	required_field_count: number;
}

interface ConnectorCache {
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

async function fetchConnector(
	obp: ObpGetter,
	connector: string,
	token: string | undefined,
	force: boolean
): Promise<ConnectorCache> {
	const cached = caches.get(connector);
	if (!force && cached && Date.now() - cached.fetchedAt < CACHE_DURATION) return cached;
	const existing = inFlight.get(connector);
	if (existing) return existing;

	const promise = (async () => {
		try {
			const resp = await obp.get(
				`/obp/v2.2.0/message-docs/${encodeURIComponent(connector)}`,
				token
			);
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

export interface MessageDocsOptions {
	token?: string;
	force?: boolean;
}

/** Every message the connector documents, ordered as an adapter is meant to implement them. */
export async function loadMessageDocIndex(
	obp: ObpGetter,
	connector: string,
	options: MessageDocsOptions = {}
): Promise<{ rows: MessageDocIndexRow[]; duplicateProcesses: string[] }> {
	const state = await fetchConnector(obp, connector, options.token, options.force ?? false);
	const rows = [...state.byProcess.values()]
		.map((d) => ({
			process: d.process,
			description: d.description ?? '',
			message_format: d.message_format ?? '',
			group: (d.adapter_implementation?.group ?? '').replace(/^-\s*/, ''),
			suggested_order: d.adapter_implementation?.suggested_order ?? null,
			dependent_endpoint_count: Array.isArray(d.dependent_endpoints) ? d.dependent_endpoints.length : 0,
			required_field_count: Object.keys(d.requiredFieldInfo ?? {}).length
		}))
		// suggested_order is the order an adapter author works through, so lead with it.
		.sort(
			(a, b) =>
				(a.suggested_order ?? Number.MAX_SAFE_INTEGER) -
					(b.suggested_order ?? Number.MAX_SAFE_INTEGER) || a.process.localeCompare(b.process)
		);
	return { rows, duplicateProcesses: state.duplicateProcesses };
}

/** One message doc in full. Undefined when this connector documents no such process. */
export async function loadMessageDoc(
	obp: ObpGetter,
	connector: string,
	process: string,
	options: MessageDocsOptions = {}
): Promise<MessageDoc | undefined> {
	const state = await fetchConnector(obp, connector, options.token, options.force ?? false);
	return state.byProcess.get(process);
}

export function clearMessageDocsCache(): void {
	caches.clear();
}
