import { describe, expect, it } from 'vitest';
import { policyBody, policyOf, SUGGESTIONS } from './retention';

const form = (entries: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(entries)) f.set(k, v);
	return f;
};

describe('policyBody', () => {
	it('builds an archive policy, keeping archive days only for archiving', () => {
		expect(
			policyBody(form({ resource_type: 'dynamic_entity_record', entity_name: 'cohort_application', date_basis: 'field:submitted_at', retain_days: '365', archive_days: '2190', action: 'archive', cascade: 'on', enabled: 'on' }))
		).toEqual({
			resource_type: 'dynamic_entity_record',
			entity_name: 'cohort_application',
			date_basis: 'field:submitted_at',
			retain_days: 365,
			archive_days: 2190,
			action: 'archive',
			cascade: true,
			requires_approval: false,
			enabled: true
		});
	});

	it('always asks for approval before deleting or anonymising', () => {
		expect(policyBody(form({ resource_type: 'consent', retain_days: '90', archive_days: '10', action: 'delete' }))).toMatchObject({ requires_approval: true });
		expect(policyBody(form({ resource_type: 'consent', retain_days: '90', archive_days: '10', action: 'delete' }))).not.toHaveProperty('archive_days');
	});

	it('sends the condition as {field, value}, and on a change leaves out what cannot change', () => {
		expect(policyBody(form({ resource_type: 'dynamic_entity_record', entity_name: 'cohort_application', condition: 'status=draft', retain_days: '90', action: 'delete' }))).toMatchObject({
			condition: { field: 'status', value: 'draft' }
		});
		const change = policyBody(form({ resource_type: 'dynamic_entity_record', entity_name: 'cohort_application', retain_days: '90', action: 'delete' }), true)!;
		expect(change).not.toHaveProperty('resource_type');
		expect(change).not.toHaveProperty('entity_name');
		expect(change.condition).toEqual({ field: '', value: '' });
		expect(policyOf({ condition: { field: 'status', value: 'draft' } }).condition).toBe('status=draft');
	});

	it('refuses what makes no sense', () => {
		expect(policyBody(form({ resource_type: 'chat_message', retain_days: '30', action: 'archive' }))).toBeNull();
		expect(policyBody(form({ resource_type: 'chat_message', retain_days: '30', action: 'delete', condition: 'nofield' }))).toBeNull();
		expect(policyBody(form({ resource_type: 'dynamic_entity_record', retain_days: '30', action: 'delete' }))).toBeNull();
		expect(policyBody(form({ resource_type: 'chat_message', retain_days: '0', action: 'delete' }))).toBeNull();
		expect(policyBody(form({ resource_type: 'chat_message', retain_days: '30', action: 'anonymise' }))).toBeNull();
		expect(policyBody(form({ resource_type: 'users', retain_days: '30', action: 'delete' }))).toBeNull();
	});
});

describe('policyOf and the suggestions', () => {
	it('reads unknown values as safe defaults', () => {
		expect(policyOf({ resource_type: 'x', action: 'y', retain_days: 'z' })).toMatchObject({ resource_type: 'dynamic_entity_record', action: 'archive', retain_days: 0, archive_days: null, enabled: false });
	});

	it('suggests archiving submitted applications and deleting only what is not an official record', () => {
		const byKey = Object.fromEntries(SUGGESTIONS.map((s) => [s.key, s]));
		expect(byKey.applications.action).toBe('archive');
		expect(byKey.drafts.action).toBe('delete');
		expect(byKey.customers.action).toBe('anonymise');
	});

	it('suggests nothing shorter than the five year minimum OBP-API enforces by default', () => {
		for (const s of SUGGESTIONS) expect(s.retain_days).toBeGreaterThanOrEqual(1825);
	});
});
