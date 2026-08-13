import { describe, it, expect } from 'vitest';
import { resolveGrpcHost, defaultGrpcHost } from './grpcHost.js';

describe('resolveGrpcHost', () => {
	it('prefers OBP_GRPC_HOST when set', () => {
		expect(
			resolveGrpcHost({
				OBP_GRPC_HOST: 'grpc.example.com:9999',
				PUBLIC_OBP_BASE_URL: 'https://api.example.com'
			})
		).toBe('grpc.example.com:9999');
	});

	it('derives grpc.<host> from PUBLIC_OBP_BASE_URL when OBP_GRPC_HOST is unset', () => {
		expect(resolveGrpcHost({ PUBLIC_OBP_BASE_URL: 'https://api.example.com' })).toBe(
			'grpc.api.example.com:50051'
		);
	});

	it('falls back to localhost when neither is set', () => {
		expect(resolveGrpcHost({})).toBe('localhost:50051');
	});
});

describe('defaultGrpcHost', () => {
	it('prefixes grpc. onto the OBP-API hostname with the standard gRPC port', () => {
		expect(defaultGrpcHost('https://api.example.com')).toBe('grpc.api.example.com:50051');
	});

	it('drops the REST port from the base URL', () => {
		expect(defaultGrpcHost('http://obp.internal:8080')).toBe('grpc.obp.internal:50051');
	});

	it('does not prefix grpc. onto localhost or IP literals', () => {
		expect(defaultGrpcHost('http://localhost:8080')).toBe('localhost:50051');
		expect(defaultGrpcHost('http://obp.localhost:8080')).toBe('obp.localhost:50051');
		expect(defaultGrpcHost('http://127.0.0.1:8080')).toBe('127.0.0.1:50051');
		expect(defaultGrpcHost('http://[::1]:8080')).toBe('[::1]:50051');
	});

	it('falls back to localhost when the base URL is unset', () => {
		expect(defaultGrpcHost(undefined)).toBe('localhost:50051');
		expect(defaultGrpcHost('')).toBe('localhost:50051');
	});

	it('falls back to localhost when the base URL is unparseable', () => {
		expect(defaultGrpcHost('not a url')).toBe('localhost:50051');
	});
});
