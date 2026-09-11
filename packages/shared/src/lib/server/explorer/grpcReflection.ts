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
 * Listing a gRPC server's services by reflection.
 *
 * OBP's gRPC surface has no resource docs — it is described by the server itself, so the
 * only way to document it is to ask. This mirrors API Explorer II's gRPC view: list the
 * services, then resolve each one's methods and the fields of their request and response
 * messages.
 *
 * Reflection has to be enabled on the server; when it is not, or the server is not
 * reachable, the caller gets an error to show rather than an exception to swallow.
 */
import { createLogger } from '$shared/utils/logger';
import { Client as ReflectionClient } from 'grpc-reflection-js';
import { grpcChannelCredentials } from '../obp/grpcCredentials.js';
import type { GrpcTarget } from '../../obp/grpcHost.js';

const logger = createLogger('GrpcReflection');

export interface GrpcFieldInfo {
	name: string;
	type: string;
	rule?: string;
	id: number;
}

export interface GrpcMethodInfo {
	name: string;
	requestType: string;
	responseType: string;
	requestStream: boolean;
	responseStream: boolean;
	requestFields: GrpcFieldInfo[];
	responseFields: GrpcFieldInfo[];
}

export interface GrpcServiceInfo {
	name: string;
	methods: GrpcMethodInfo[];
	/** Set when this one service could not be resolved; the others still list. */
	error?: string;
}

/** The reflection service itself is plumbing, not part of the API being documented. */
const REFLECTION_SERVICE_NAMES = new Set([
	'grpc.reflection.v1.ServerReflection',
	'grpc.reflection.v1alpha.ServerReflection'
]);

function extractFields(root: any, typeName: string): GrpcFieldInfo[] {
	try {
		const type = root.lookupType(typeName);
		return Object.values(type.fields).map((f: any) => ({
			name: f.name,
			type: f.type,
			rule: f.rule,
			id: f.id
		}));
	} catch {
		// A message whose type is not in the same file descriptor: name it, skip its fields.
		return [];
	}
}

export async function listGrpcServices(
	target: GrpcTarget
): Promise<{ host: string; services: GrpcServiceInfo[]; error?: string }> {
	let client: ReflectionClient | null = null;
	try {
		logger.info(`Reflecting against ${target.host}`);
		client = new ReflectionClient(target.host, grpcChannelCredentials(target));

		const serviceNames = await client.listServices();
		const services: GrpcServiceInfo[] = [];

		for (const name of serviceNames) {
			if (REFLECTION_SERVICE_NAMES.has(name)) continue;
			try {
				const root = await client.fileContainingSymbol(name);
				const service = root.lookup(name) as any;
				if (!service?.methods) {
					services.push({ name, methods: [] });
					continue;
				}
				services.push({
					name,
					methods: Object.values(service.methods).map((m: any) => ({
						name: m.name,
						requestType: m.requestType,
						responseType: m.responseType,
						requestStream: !!m.requestStream,
						responseStream: !!m.responseStream,
						requestFields: extractFields(root, m.requestType),
						responseFields: extractFields(root, m.responseType)
					}))
				});
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				logger.warn(`Could not resolve ${name}: ${message}`);
				services.push({ name, methods: [], error: message });
			}
		}

		services.sort((a, b) => a.name.localeCompare(b.name));
		return { host: target.host, services };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		logger.error(`Reflection failed against ${target.host}: ${message}`);
		return { host: target.host, services: [], error: message };
	} finally {
		const grpcClient = (client as any)?.grpcClient;
		if (grpcClient && typeof grpcClient.close === 'function') grpcClient.close();
	}
}

/** `.code.signal.FetchRequest` -> `FetchRequest`. */
export function shortTypeName(fullyQualified: string): string {
	if (!fullyQualified) return '';
	const trimmed = fullyQualified.startsWith('.') ? fullyQualified.slice(1) : fullyQualified;
	return trimmed.split('.').pop() ?? trimmed;
}

export function methodSignature(method: GrpcMethodInfo): string {
	const req = `${method.requestStream ? 'stream ' : ''}${shortTypeName(method.requestType)}`;
	const res = `${method.responseStream ? 'stream ' : ''}${shortTypeName(method.responseType)}`;
	return `rpc ${method.name}(${req}) returns (${res})`;
}
