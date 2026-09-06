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
import { describe, it, expect } from 'vitest';
import { resolveGrpcTarget, defaultGrpcHost } from './grpcHost.js';

describe('resolveGrpcTarget', () => {
	it('prefers OBP_GRPC_HOST when set', () => {
		expect(
			resolveGrpcTarget({
				OBP_GRPC_HOST: 'grpc.example.com:9999',
				PUBLIC_OBP_BASE_URL: 'https://api.example.com'
			})
		).toEqual({ host: 'grpc.example.com:9999', tls: false });
	});

	it('derives grpc.<host>:443 with TLS from an https PUBLIC_OBP_BASE_URL', () => {
		expect(resolveGrpcTarget({ PUBLIC_OBP_BASE_URL: 'https://api.example.com' })).toEqual({
			host: 'grpc.api.example.com:443',
			tls: true
		});
	});

	it('derives grpc.<host>:50051 without TLS from an http PUBLIC_OBP_BASE_URL', () => {
		expect(resolveGrpcTarget({ PUBLIC_OBP_BASE_URL: 'http://obp.internal:8080' })).toEqual({
			host: 'grpc.obp.internal:50051',
			tls: false
		});
	});

	it('turns on TLS for an explicit host on port 443', () => {
		expect(resolveGrpcTarget({ OBP_GRPC_HOST: 'grpc.example.com:443' })).toEqual({
			host: 'grpc.example.com:443',
			tls: true
		});
	});

	it('lets OBP_GRPC_TLS override the port-based default in both directions', () => {
		expect(
			resolveGrpcTarget({ OBP_GRPC_HOST: 'grpc.example.com:443', OBP_GRPC_TLS: 'false' }).tls
		).toBe(false);
		expect(
			resolveGrpcTarget({ OBP_GRPC_HOST: 'grpc.example.com:50051', OBP_GRPC_TLS: 'true' }).tls
		).toBe(true);
	});

	it('falls back to localhost:50051 without TLS when nothing is set', () => {
		expect(resolveGrpcTarget({})).toEqual({ host: 'localhost:50051', tls: false });
	});
});

describe('defaultGrpcHost', () => {
	it('uses port 443 for https base URLs and 50051 for http ones', () => {
		expect(defaultGrpcHost('https://api.example.com')).toBe('grpc.api.example.com:443');
		expect(defaultGrpcHost('http://obp.internal:8080')).toBe('grpc.obp.internal:50051');
	});

	it('does not prefix grpc. onto localhost or IP literals', () => {
		expect(defaultGrpcHost('http://localhost:8080')).toBe('localhost:50051');
		expect(defaultGrpcHost('http://obp.localhost:8080')).toBe('obp.localhost:50051');
		expect(defaultGrpcHost('http://127.0.0.1:8080')).toBe('127.0.0.1:50051');
		expect(defaultGrpcHost('http://[::1]:8080')).toBe('[::1]:50051');
	});

	it('falls back to localhost when the base URL is unset or unparseable', () => {
		expect(defaultGrpcHost(undefined)).toBe('localhost:50051');
		expect(defaultGrpcHost('')).toBe('localhost:50051');
		expect(defaultGrpcHost('not a url')).toBe('localhost:50051');
	});
});
