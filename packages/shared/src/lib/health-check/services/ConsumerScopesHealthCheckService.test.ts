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
import { evaluateConsumerScopes, consumerScopesSnapshot, describeDeclaration } from './ConsumerScopesHealthCheckService';
import type { RequiredConsumerScope } from '$shared/obp/requiredConsumerScopes';

const required: RequiredConsumerScope[] = [
	{ role_name: 'CanGetThing', bank_id: 'SYS', needed_for: 'Showing things.' },
	{ role_name: 'CanMakeThing', bank_id: 'SYS', needed_for: 'Making things.', optional: true }
];

describe('evaluateConsumerScopes', () => {
	it('is ok when every required Scope is held at its bank id', () => {
		const report = evaluateConsumerScopes(required, {
			status: 200,
			body: { consumer_id: 'c-1', scopes: [{ role_name: 'CanGetThing', bank_id: 'SYS' }] }
		});
		expect(report.state).toBe('ok');
		expect(report.consumer_id).toBe('c-1');
		expect(report.scopes.map((s) => s.held)).toEqual([true, false]);
		const snapshot = consumerScopesSnapshot(report);
		expect(snapshot.status).toBe('healthy');
		expect(snapshot.details!['CanMakeThing at SYS']).toBe('missing (optional)');
	});

	it('does not count a Scope held at another bank id', () => {
		const report = evaluateConsumerScopes(required, {
			status: 200,
			body: { consumer_id: 'c-1', scopes: [{ role_name: 'CanGetThing', bank_id: '' }] }
		});
		expect(report.state).toBe('missing');
		const snapshot = consumerScopesSnapshot(report);
		expect(snapshot.status).toBe('unhealthy');
		expect(snapshot.error).toContain('Missing CanGetThing at SYS, needed for: Showing things.');
		expect(snapshot.error).not.toContain('CanMakeThing');
	});

	it('is unknown when OBP-API has no such endpoint', () => {
		const report = evaluateConsumerScopes(required, { status: 404, body: { message: 'OBP-10404' } });
		expect(report.state).toBe('unknown');
		expect(report.problem).toContain('/obp/v7.0.0/consumers/current/scopes');
		expect(consumerScopesSnapshot(report).status).toBe('unknown');
	});

	it('is unknown, with OBP\'s message, when the call is refused', () => {
		const report = evaluateConsumerScopes(required, { status: 401, body: { message: 'OBP-20214: Application not identified' } });
		expect(report.state).toBe('unknown');
		expect(report.problem).toContain('401: OBP-20214');
	});
});

describe('describeDeclaration', () => {
	it('is declared on 200', () => {
		expect(describeDeclaration({ status: 200, body: {} })).toEqual({ accepted: true, text: 'declared' });
	});
	it('tells a Consumer nobody has marked from an OBP-API without Platform Apps', () => {
		expect(describeDeclaration({ status: 404, body: { message: 'OBP-35046: This Consumer is not a Platform App.' } }).text)
			.toContain('not marked');
		expect(describeDeclaration({ status: 404, body: { message: 'OBP-10404: 404 Not Found.' } }).text)
			.toContain('not supported');
	});
});
