import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every OBP-API call in the app stack uses v5.1.0 or newer, so a deployment can disable
// the older API versions. Calls that have no equivalent in v5.1.0 are listed below with
// the reason; anything else below v5.1.0 fails this test.

const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../../..');
const SOURCE_ROOTS = ['apps', 'packages'];
const SKIP_DIRS = new Set(['node_modules', '.svelte-kit', 'build', 'dist', 'test-results', 'docs']);
const EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs', '.svelte'];
const OLD_VERSION = /\/obp\/(v(?:[1-4])\.\d+\.\d+|v5\.0\.0)\//g;

/** file (repo-relative) + path fragment -> why it is still below v5.1.0 */
const NO_V510_EQUIVALENT: Record<string, string> = {
	'apps/cohort/src/routes/(protected)/staff/organisations/+page.server.ts|/obp/v3.0.0/users/username/':
		'GET users/username/USERNAME is excluded from v5.1.0; v5.1.0 needs a provider: users/provider/PROVIDER/username/USERNAME',
	'apps/cohort/scripts/seed-demo-data.mjs|/obp/v3.0.0/users/username/':
		'GET users/username/USERNAME is excluded from v5.1.0; v5.1.0 needs a provider: users/provider/PROVIDER/username/USERNAME',
	'apps/cohort/src/routes/(protected)/staff/organisations/+page.server.ts|/obp/v4.0.0/banks/${space()}/customers?':
		'v4.0.0 filters customers by attribute; v5.1.0 serves getCustomersAtOneBank without attribute filtering',
	'apps/cohort/scripts/seed-demo-data.mjs|/obp/v4.0.0/banks/${space}/customers?':
		'v4.0.0 filters customers by attribute; v5.1.0 serves getCustomersAtOneBank without attribute filtering'
};

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
		const path = join(dir, name);
		if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
		else if (EXTENSIONS.some((ext) => name.endsWith(ext)) && !/\.(test|spec)\.[a-z]+$/.test(name))
			out.push(path);
	}
	return out;
}

function callsBelowV510(): string[] {
	const found: string[] = [];
	for (const root of SOURCE_ROOTS) {
		for (const file of sourceFiles(join(REPO_ROOT, root))) {
			const rel = relative(REPO_ROOT, file);
			readFileSync(file, 'utf8')
				.split('\n')
				.forEach((line, i) => {
					for (const match of line.matchAll(OLD_VERSION)) {
						const allowed = Object.keys(NO_V510_EQUIVALENT).some((key) => {
							const [keyFile, fragment] = key.split('|');
							return keyFile === rel && line.includes(fragment);
						});
						if (!allowed) found.push(`${rel}:${i + 1} ${match[0]}`);
					}
				});
		}
	}
	return found;
}

describe('OBP-API version used by the app stack', () => {
	it('finds the app sources', () => {
		expect(sourceFiles(join(REPO_ROOT, 'apps')).length).toBeGreaterThan(100);
	});

	it('calls OBP-API on v5.1.0 or newer', () => {
		expect(callsBelowV510()).toEqual([]);
	});

	it('keeps the list of calls without a v5.1.0 equivalent current', () => {
		for (const key of Object.keys(NO_V510_EQUIVALENT)) {
			const [file, fragment] = key.split('|');
			expect(readFileSync(join(REPO_ROOT, file), 'utf8'), key).toContain(fragment);
		}
	});
});
