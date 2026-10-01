import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getWebUiProps, resolveWebUiValues, _resetWebUiPropsCache } from './webUiProps';

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
