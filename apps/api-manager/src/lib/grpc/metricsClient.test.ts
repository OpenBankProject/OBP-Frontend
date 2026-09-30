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

	it('gives an empty list of hops, since the stream does not carry it', () => {
		expect(formatMetricEvent(event).forwarded_for).toBe('');
	});

	it('passes the list of hops through once the stream carries it', () => {
		const withHops = { ...event, forwarded_for: '203.0.113.9, 10.0.0.2' };
		expect(formatMetricEvent(withHops).forwarded_for).toBe('203.0.113.9, 10.0.0.2');
	});
});
