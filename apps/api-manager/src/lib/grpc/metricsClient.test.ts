import { describe, it, expect } from 'vitest';
import { formatMetricEvent } from './metricsClient';

describe('formatMetricEvent', () => {
	const event = {
		url: '/obp/v6.0.0/banks',
		date: '2026-09-30T10:00:00Z',
		duration: '12',
		verb: 'GET',
		status_code: 200,
		source_ip: '203.0.113.9',
		target_ip: ''
	};

	it('keeps the resolved client address', () => {
		expect(formatMetricEvent(event).source_ip).toBe('203.0.113.9');
	});

	it('gives empty values for fields an older OBP-API does not send', () => {
		const formatted = formatMetricEvent(event);
		expect(formatted.forwarded_for).toBe('');
		expect(formatted.auth_type).toBe('');
		expect(formatted.certificate_trust).toBe('');
		expect(formatted.certificate_trust_detail).toBe('');
	});

	it('passes the list of hops, the authentication scheme and the certificate trust through', () => {
		const formatted = formatMetricEvent({
			...event,
			forwarded_for: '203.0.113.9, 10.0.0.2',
			auth_type: 'OAuth2',
			certificate_trust: 'forwarded',
			certificate_trust_detail: 'CN=proxy,O=Example'
		});
		expect(formatted.forwarded_for).toBe('203.0.113.9, 10.0.0.2');
		expect(formatted.auth_type).toBe('OAuth2');
		expect(formatted.certificate_trust).toBe('forwarded');
		expect(formatted.certificate_trust_detail).toBe('CN=proxy,O=Example');
	});
});
