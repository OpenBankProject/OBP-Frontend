/** Lives outside src/lib/server so vitest picks it up. */
import { describe, it, expect, vi } from 'vitest';
import { ensureSystemDynamicEntity, dynamicEntityDrift } from '../server/obp/dynamicEntityBootstrap';

const definition = {
	entity_name: 'notes',
	auth_mode: 'UserOnly',
	schema: { properties: { title: { type: 'string' }, page: { type: 'string' } } }
};

function deps(existing: any[] = []) {
	const put = vi.fn(async () => ({}));
	const post = vi.fn(async () => ({}));
	const get = vi.fn(async () => ({ dynamic_entities: existing }));
	return { deps: { get, post, put, accessToken: 'app-token' }, get, post, put };
}

describe('ensureSystemDynamicEntity', () => {
	it('creates a missing entity', async () => {
		const d = deps([]);
		expect(await ensureSystemDynamicEntity(definition, d.deps)).toBe(true);
		expect(d.post).toHaveBeenCalledWith('/obp/v6.0.0/management/system-dynamic-entities', definition, 'app-token');
		expect(d.put).not.toHaveBeenCalled();
	});

	it('leaves a current entity alone', async () => {
		const d = deps([{ dynamic_entity_id: 'de-1', entity_name: 'notes', auth_mode: 'UserOnly', schema: { properties: { title: {}, page: {} } } }]);
		expect(await ensureSystemDynamicEntity(definition, d.deps)).toBe(true);
		expect(d.post).not.toHaveBeenCalled();
		expect(d.put).not.toHaveBeenCalled();
	});

	it('updates an entity that lacks a property the definition has', async () => {
		const d = deps([{ dynamic_entity_id: 'de-1', entity_name: 'notes', auth_mode: 'UserOnly', schema: { properties: { title: {} } } }]);
		expect(await ensureSystemDynamicEntity(definition, d.deps)).toBe(true);
		expect(d.put).toHaveBeenCalledWith('/obp/v6.0.0/management/system-dynamic-entities/de-1', definition, 'app-token');
		expect(d.post).not.toHaveBeenCalled();
	});

	it('updates when auth_mode differs and still reports true if the update fails', async () => {
		const d = deps([{ dynamic_entity_id: 'de-1', entity_name: 'notes', auth_mode: 'UserOrApplication', schema: { properties: { title: {}, page: {} } } }]);
		d.put.mockRejectedValueOnce(new Error('403'));
		expect(await ensureSystemDynamicEntity(definition, d.deps)).toBe(true);
		expect(d.put).toHaveBeenCalledTimes(1);
	});

	it('only logs when it cannot update (no put) and fails softly without a token', async () => {
		const d = deps([{ dynamic_entity_id: 'de-1', entity_name: 'notes', schema: { properties: {} } }]);
		expect(await ensureSystemDynamicEntity(definition, { get: d.get, post: d.post, accessToken: 'app-token' })).toBe(true);
		expect(await ensureSystemDynamicEntity(definition, { ...d.deps, accessToken: null })).toBe(false);
	});
});

describe('dynamicEntityDrift', () => {
	it('names what differs and never asks to remove properties', () => {
		expect(dynamicEntityDrift({ auth_mode: 'UserOnly', schema: { properties: { title: {}, page: {}, extra: {} } } }, definition)).toEqual([]);
		expect(dynamicEntityDrift({ schema: { properties: {} } }, definition)).toEqual(['missing properties: title, page']);
		expect(dynamicEntityDrift({ auth_mode: 'ApplicationOnly', schema: { properties: { title: {}, page: {} } } }, definition)).toEqual(['auth_mode ApplicationOnly -> UserOnly']);
	});
});
