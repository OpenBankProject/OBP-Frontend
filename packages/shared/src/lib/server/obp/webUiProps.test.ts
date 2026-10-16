import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	getWebUiProps,
	resolveWebUiValues,
	bumpWebUiProps,
	setWebUiPropsGenerationStore,
	_resetWebUiPropsCache
} from './webUiProps';

const props = (...pairs: [string, string][]) => ({
	webui_props: pairs.map(([name, value]) => ({ name, value, source: 'database' }))
});

const SETTINGS = {
	title: { envVar: 'PUBLIC_WELCOME_TITLE', default: 'Welcome!' },
	description: { envVar: 'PUBLIC_WELCOME_DESCRIPTION', default: 'Default description' }
};

describe('resolveWebUiValues', () => {
	beforeEach(() => _resetWebUiPropsCache());

	it('prefers the webui_prop, then the env var, then the default', async () => {
		const get = vi.fn().mockResolvedValue(props(['webui_welcome_title', 'From OBP']));
		const r = await resolveWebUiValues(get, { PUBLIC_WELCOME_TITLE: 'From env', PUBLIC_WELCOME_DESCRIPTION: 'Env desc' }, SETTINGS);
		expect(r.title).toEqual({ value: 'From OBP', source: 'webui_prop', webUiPropName: 'webui_welcome_title', envVar: 'PUBLIC_WELCOME_TITLE' });
		expect(r.description).toMatchObject({ value: 'Env desc', source: 'env', webUiPropName: 'webui_welcome_description' });
	});

	it('treats blank values as unset', async () => {
		const get = vi.fn().mockResolvedValue(props(['webui_welcome_title', '  ']));
		const r = await resolveWebUiValues(get, { PUBLIC_WELCOME_TITLE: '' }, SETTINGS);
		expect(r.title).toMatchObject({ value: 'Welcome!', source: 'default' });
	});

	it('falls back to env when OBP is unreachable', async () => {
		const get = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
		const r = await resolveWebUiValues(get, { PUBLIC_WELCOME_TITLE: 'From env' }, SETTINGS);
		expect(r.title).toMatchObject({ value: 'From env', source: 'env' });
	});
});

describe('getWebUiProps', () => {
	beforeEach(() => _resetWebUiPropsCache());

	it('fetches once and serves later calls from the cache', async () => {
		const get = vi.fn().mockResolvedValue(props(['webui_a', '1']));
		await getWebUiProps(get);
		const values = await getWebUiProps(get);
		expect(get).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenCalledWith('/obp/v6.0.0/webui-props?what=database');
		expect(values.get('webui_a')).toBe('1');
	});

	it('serves stale values when a refresh fails', async () => {
		vi.useFakeTimers();
		try {
			const get = vi.fn().mockResolvedValueOnce(props(['webui_a', '1'])).mockRejectedValue(new Error('down'));
			await getWebUiProps(get);
			vi.advanceTimersByTime(6 * 60 * 1000);
			expect((await getWebUiProps(get)).get('webui_a')).toBe('1');
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('bumping', () => {
	// Stands in for the Redis both apps share
	function fakeRedis() {
		const data = new Map<string, string>();
		return {
			get: async (key: string) => data.get(key) ?? null,
			incr: async (key: string) => {
				const n = Number(data.get(key) ?? 0) + 1;
				data.set(key, String(n));
				return n;
			}
		};
	}

	beforeEach(() => _resetWebUiPropsCache());
	afterEach(() => setWebUiPropsGenerationStore(null));

	it('refetches when another process bumped the generation', async () => {
		const redis = fakeRedis();
		setWebUiPropsGenerationStore(redis);
		const get = vi.fn().mockResolvedValueOnce(props(['webui_a', 'old'])).mockResolvedValue(props(['webui_a', 'new']));
		expect((await getWebUiProps(get)).get('webui_a')).toBe('old');
		expect((await getWebUiProps(get)).get('webui_a')).toBe('old');
		await redis.incr('obp_frontend:webui_props:generation'); // the Manager saved a prop
		expect((await getWebUiProps(get)).get('webui_a')).toBe('new');
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('bumpWebUiProps clears this process and increments the shared generation', async () => {
		const redis = fakeRedis();
		setWebUiPropsGenerationStore(redis);
		const get = vi.fn().mockResolvedValue(props(['webui_a', '1']));
		await getWebUiProps(get);
		await bumpWebUiProps();
		await getWebUiProps(get);
		expect(get).toHaveBeenCalledTimes(2);
		expect(await redis.get('obp_frontend:webui_props:generation')).toBe('1');
	});

	it('falls back to the TTL when Redis does not answer', async () => {
		setWebUiPropsGenerationStore({ get: () => new Promise(() => {}), incr: () => new Promise(() => {}) });
		const get = vi.fn().mockResolvedValue(props(['webui_a', '1']));
		await getWebUiProps(get);
		expect((await getWebUiProps(get)).get('webui_a')).toBe('1');
		expect(get).toHaveBeenCalledTimes(1);
	});
});
