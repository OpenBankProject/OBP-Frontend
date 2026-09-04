import { describe, it, expect } from 'vitest';
import { normalizeMyResources, myResourcesCovered } from './consentReuse';

describe('normalizeMyResources', () => {
	it('treats absent, null and empty as none', () => {
		expect(normalizeMyResources(undefined)).toBeNull();
		expect(normalizeMyResources(null)).toBeNull();
		expect(normalizeMyResources({})).toBeNull();
		expect(normalizeMyResources({ personal_dynamic_entities: [] })).toBeNull();
	});

	it('cleans a valid block, defaulting bank_id and deduping actions', () => {
		expect(
			normalizeMyResources({
				personal_dynamic_entities: [{ entity_name: 'notes', actions: ['read', 'read', 'write'] }]
			})
		).toEqual({ personal_dynamic_entities: [{ bank_id: '', entity_name: 'notes', actions: ['read', 'write'] }] });
	});

	it('rejects wrong shapes', () => {
		expect(normalizeMyResources('nope')).toBeUndefined();
		expect(normalizeMyResources({ personal_dynamic_entities: 'nope' })).toBeUndefined();
		expect(normalizeMyResources({ personal_dynamic_entities: [{ actions: ['read'] }] })).toBeUndefined();
		expect(normalizeMyResources({ personal_dynamic_entities: [{ entity_name: 'notes', actions: [] }] })).toBeUndefined();
		expect(normalizeMyResources({ personal_dynamic_entities: [{ entity_name: 'notes', actions: ['delete'] }] })).toBeUndefined();
	});
});

describe('myResourcesCovered', () => {
	const required = { personal_dynamic_entities: [{ bank_id: '', entity_name: 'notes', actions: ['read', 'write'] }] };

	it('is satisfied when nothing is required', () => {
		expect(myResourcesCovered(undefined, null)).toBe(true);
	});

	it('needs the same entity at the same bank with a superset of actions', () => {
		expect(myResourcesCovered({ personal_dynamic_entities: [{ bank_id: '', entity_name: 'notes', actions: ['read', 'write'] }] }, required)).toBe(true);
		expect(myResourcesCovered({ personal_dynamic_entities: [{ bank_id: '', entity_name: 'notes', actions: ['read'] }] }, required)).toBe(false);
		expect(myResourcesCovered({ personal_dynamic_entities: [{ bank_id: 'b1', entity_name: 'notes', actions: ['read', 'write'] }] }, required)).toBe(false);
		expect(myResourcesCovered({ personal_dynamic_entities: [{ bank_id: '', entity_name: 'other', actions: ['read', 'write'] }] }, required)).toBe(false);
		expect(myResourcesCovered(undefined, required)).toBe(false);
	});
});
