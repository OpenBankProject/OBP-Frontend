import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The contract between the apps and OBP-API.
//
// obp-api-contract/contract.json lists every OBP-API call the apps and the shared package make, with the
// response fields the code reads. obp-api-contract/snapshot.json is what an OBP-API documents for those
// calls, written by obp-api-contract/snapshot.py from its resource docs. These tests need no server. They
// check that the list matches the code, and that every call reaches an endpoint OBP-API documents, with
// every field the code reads. Take the snapshot again from a new OBP-API build to learn whether that
// build breaks an app.

const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../../..');
const CONTRACT_DIR = join(REPO_ROOT, 'obp-api-contract');
const SOURCE_ROOTS = ['apps', 'packages'];
const SKIP_DIRS = new Set(['node_modules', '.svelte-kit', 'build', 'dist']);
const EXTENSIONS = ['.ts', '.js', '.svelte'];
/** A line that builds an OBP-API path: `/obp/v6.0.0/...`, `/obp/${API_VERSION}/...` or `${OBP_API_URL}/...`. */
const OBP_PATH = /obp\/(v\d|\$\{)|\$\{OBP_API_URL\}/;
const COMMENT = /^\s*(\/\/|\*|\/\*)/;

interface Call {
	verb: string;
	path: string;
	source: string;
	needles: string[];
	reads?: string[];
	undocumented_fields?: string[];
	undocumented_endpoint?: string;
	note?: string;
}

interface NotCall {
	source: string;
	needles: string[];
	reason: string;
}

interface SnapshotEntry {
	verb: string;
	path: string;
	operation_id?: string;
	fields?: string[];
	missing?: boolean;
	ambiguous?: string[];
}

function load<T>(name: string): T {
	return JSON.parse(readFileSync(join(CONTRACT_DIR, name), 'utf8')) as T;
}

const contract = load<{ calls: Call[]; not_calls: NotCall[] }>('contract.json');
const snapshot = load<{ endpoints: SnapshotEntry[] }>('snapshot.json');

const key = (call: { verb: string; path: string }) => `${call.verb} ${call.path}`;

/** The reads of `call` that `fields` does not document. A read written `a|b` is satisfied by either field. */
function undocumentedReads(call: { reads?: string[] }, fields: Set<string>): string[] {
	return (call.reads ?? []).filter((read) => !read.split('|').some((f) => fields.has(f)));
}

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

/** Lines of app source that build an OBP-API path, skipping comments and Svelte markup. */
function obpPathLines(): { file: string; n: number; line: string }[] {
	const out: { file: string; n: number; line: string }[] = [];
	for (const root of SOURCE_ROOTS) {
		for (const top of readdirSync(join(REPO_ROOT, root))) {
			const src = join(REPO_ROOT, root, top, 'src');
			if (!statSync(join(REPO_ROOT, root, top)).isDirectory()) continue;
			let files: string[];
			try {
				files = sourceFiles(src);
			} catch {
				continue;
			}
			for (const file of files) {
				const rel = relative(REPO_ROOT, file).split('\\').join('/');
				// In a Svelte file only the <script> blocks run; text in the markup builds no path.
				let inScript = !file.endsWith('.svelte');
				readFileSync(file, 'utf8')
					.split('\n')
					.forEach((line, i) => {
						if (file.endsWith('.svelte') && /<script\b/.test(line)) inScript = true;
						if (inScript && !COMMENT.test(line) && /["'`]/.test(line) && OBP_PATH.test(line))
							out.push({ file: rel, n: i + 1, line });
						if (file.endsWith('.svelte') && line.includes('</script>')) inScript = false;
					});
			}
		}
	}
	return out;
}

describe('OBP-API contract', () => {
	it('lists every call with a needle that is in its source file', () => {
		// Each listed call, and each listed line that is not a call, still exists in its source file.
		const gone: string[] = [];
		for (const entry of [...contract.calls, ...contract.not_calls]) {
			const text = readFileSync(join(REPO_ROOT, entry.source), 'utf8');
			if (entry.needles.length === 0) gone.push(`${entry.source}: no needles`);
			for (const needle of entry.needles)
				if (!text.includes(needle))
					gone.push(
						`${entry.source}: ${'verb' in entry ? key(entry as Call) : 'not a call'} — ${needle}`
					);
		}
		expect(gone).toEqual([]);
	});

	it('lists every OBP-API path the source builds', () => {
		// A line that builds an OBP-API path must contain a needle of a call or of a not_calls entry for the
		// same file, so a new call cannot reach OBP-API without its fields being recorded.
		const entries = [...contract.calls, ...contract.not_calls];
		const unlisted = obpPathLines()
			.filter(
				({ file, line }) =>
					!entries.some((e) => e.source === file && e.needles.some((n) => line.includes(n.trim())))
			)
			.map(({ file, n, line }) => `${file}:${n} ${line.trim()}`);
		expect(unlisted).toEqual([]);
	});

	it('holds a snapshot taken for this contract', () => {
		// snapshot.json must hold exactly the calls of contract.json; otherwise run snapshot.py again.
		const listed = [...new Set(contract.calls.map(key))].sort();
		const snapped = [...new Set(snapshot.endpoints.map(key))].sort();
		expect(snapped).toEqual(listed);
	});

	it('reaches an endpoint OBP-API documents with every call', () => {
		// Each call's version and path must name a documented endpoint, unless the entry says why not in
		// undocumented_endpoint. A recorded gap that OBP-API has since documented fails too, so the note goes.
		const problems: string[] = [];
		for (const call of contract.calls) {
			const entry = snapshot.endpoints.find((e) => key(e) === key(call));
			const missing = !entry || entry.missing === true;
			if (missing && !call.undocumented_endpoint)
				problems.push(`${key(call)}: no documented endpoint`);
			if (!missing && call.undocumented_endpoint)
				problems.push(
					`${key(call)}: now documented as ${entry?.operation_id}; drop undocumented_endpoint`
				);
			if (entry?.ambiguous)
				problems.push(`${key(call)}: matches several endpoints ${entry.ambiguous.join(', ')}`);
		}
		expect(problems).toEqual([]);
	});

	it('reads only fields OBP-API documents', () => {
		// Each field the code reads must be in the documented response of its endpoint, unless the entry lists
		// it in undocumented_fields. A listed field that OBP-API now documents fails, so the list shrinks.
		const problems: string[] = [];
		for (const call of contract.calls) {
			const entry = snapshot.endpoints.find((e) => key(e) === key(call));
			if (!entry || entry.missing) continue;
			const fields = new Set(entry.fields ?? []);
			const known = new Set(call.undocumented_fields ?? []);
			for (const read of undocumentedReads(call, fields))
				if (!known.has(read))
					problems.push(
						`${key(call)} (${entry.operation_id}, ${call.source}): reads ${read}, not documented`
					);
			for (const field of known) {
				if (field.split('|').some((f) => fields.has(f)))
					problems.push(
						`${key(call)}: ${field} is now documented; drop it from undocumented_fields`
					);
				if (!(call.reads ?? []).includes(field))
					problems.push(`${key(call)}: ${field} is in undocumented_fields but not in reads`);
			}
		}
		expect(problems).toEqual([]);
	});

	it('reports a renamed or removed field', () => {
		// Tests the check itself: with `bank_id` gone from the documented fields the read is reported, and a
		// read with an alternative (`banks[].id|banks[].bank_id`) passes on either field.
		const banks = { reads: ['banks[].bank_id'] };
		expect(undocumentedReads(banks, new Set(['banks[]', 'banks[].id']))).toEqual([
			'banks[].bank_id'
		]);
		const either = { reads: ['banks[].id|banks[].bank_id'] };
		expect(undocumentedReads(either, new Set(['banks[].bank_id']))).toEqual([]);
		expect(undocumentedReads(either, new Set())).toEqual(['banks[].id|banks[].bank_id']);
	});

	it('finds the lines that build OBP-API paths', () => {
		// Tests the coverage scan itself: it sees the app sources and the ways a path is written.
		expect(obpPathLines().length).toBeGreaterThan(300);
		expect(OBP_PATH.test('`/proxy/obp/v6.0.0/banks/${bankId}`')).toBe(true);
		expect(OBP_PATH.test('`/obp/${API_VERSION}/banks`')).toBe(true);
		expect(OBP_PATH.test('`${OBP_API_URL}/users/current`')).toBe(true);
		expect(OBP_PATH.test("'/obp/dynamic-entity/my/notes'")).toBe(false);
	});
});
