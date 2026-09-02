import { describe, it, expect } from 'vitest';
import {
	APP_STUDIO_SHIM_SOURCE,
	appStudioPathToProxyPath,
	buildAppStudioSrcdoc
} from './appStudioShim.js';

describe('buildAppStudioSrcdoc', () => {
	it('injects the shim right after <head> so it runs before app scripts', () => {
		const out = buildAppStudioSrcdoc('<!doctype html><html><head><title>x</title><script>app()</script></head><body></body></html>');
		const shimAt = out.indexOf(APP_STUDIO_SHIM_SOURCE);
		expect(shimAt).toBeGreaterThan(-1);
		expect(shimAt).toBeLessThan(out.indexOf('app()'));
		expect(out.indexOf('<head>')).toBeLessThan(shimAt);
	});

	it('adds a head when the document has <html> but no <head>', () => {
		const out = buildAppStudioSrcdoc('<html><body><p>hi</p></body></html>');
		expect(out).toMatch(/<html><head><script>/);
		expect(out).toContain('<p>hi</p>');
	});

	it('wraps a bare fragment in a full mobile document', () => {
		const out = buildAppStudioSrcdoc('<p>hi</p>');
		expect(out.startsWith('<!doctype html>')).toBe(true);
		expect(out).toContain('name="viewport"');
		expect(out).toContain('<body><p>hi</p></body>');
	});

	it('handles an empty source', () => {
		expect(buildAppStudioSrcdoc('')).toContain(APP_STUDIO_SHIM_SOURCE);
	});
});

describe('appStudioPathToProxyPath', () => {
	it('maps /obp/… onto the host proxy, keeping the query string', () => {
		expect(appStudioPathToProxyPath('/obp/v6.0.0/banks?limit=5')).toBe('/proxy/obp/v6.0.0/banks?limit=5');
	});

	it('honours a custom proxy base', () => {
		expect(appStudioPathToProxyPath('/obp/v6.0.0/banks', '/backend/studio')).toBe('/backend/studio/v6.0.0/banks');
	});

	it('rejects paths that are not OBP paths or try to escape', () => {
		expect(appStudioPathToProxyPath('/proxy/obp/v6.0.0/banks')).toBeNull();
		expect(appStudioPathToProxyPath('https://evil.example/obp/x')).toBeNull();
		expect(appStudioPathToProxyPath('/obp/../../etc')).toBeNull();
		expect(appStudioPathToProxyPath('')).toBeNull();
	});
});

describe('APP_STUDIO_SHIM_SOURCE', () => {
	it('is plain script that defines window.obp and relays console output', () => {
		expect(APP_STUDIO_SHIM_SOURCE).toContain('window.obp = {');
		expect(APP_STUDIO_SHIM_SOURCE).toContain("'obp-studio:request'");
		expect(APP_STUDIO_SHIM_SOURCE).toContain("'obp-studio:log'");
		expect(APP_STUDIO_SHIM_SOURCE).not.toContain('import ');
		expect(APP_STUDIO_SHIM_SOURCE).not.toContain('</script>');
	});
});
