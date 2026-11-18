/*
 * Copyright (C) 2026 TESOBE GmbH
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
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { describeForm, fillForm } from './formFill';

function form(): HTMLFormElement {
	document.body.innerHTML = `
		<form>
			<label><span>Test ID</span><input name="test_id" maxlength="10" required /></label>
			<select name="kind"><option value="automated">Automated</option><option value="evidence">Evidence</option></select>
			<label><input type="checkbox" name="mandatory" checked /> Mandatory</label>
			<label><input type="checkbox" name="requirement_ids" value="r1" /> DEMO 1.1 Consents</label>
			<label><input type="checkbox" name="requirement_ids" value="r2" checked /> DEMO 1.2 Status</label>
			<textarea name="definition"></textarea>
			<input type="hidden" name="secret" value="x" />
			<button>Add</button>
		</form>`;
	return document.querySelector('form')!;
}

describe('fillForm', () => {
	it('writes each kind of field, and sends input events so bindings follow', () => {
		const f = form();
		const seen: string[] = [];
		f.addEventListener('input', (e) => seen.push((e.target as HTMLInputElement).name));
		const result = fillForm(f, { test_id: 'AIS-001', kind: 'evidence', mandatory: false, requirement_ids: ['r1'], definition: { steps: [] } });
		expect(result).toEqual({ applied: ['test_id', 'kind', 'mandatory', 'requirement_ids', 'definition'], ignored: [] });
		const data = new FormData(f);
		expect(data.get('test_id')).toBe('AIS-001');
		expect(data.get('kind')).toBe('evidence');
		expect(data.get('mandatory')).toBeNull();
		expect(data.getAll('requirement_ids')).toEqual(['r1']);
		expect(JSON.parse(String(data.get('definition')))).toEqual({ steps: [] });
		expect(seen).toContain('definition');
	});

	it('leaves out names the form lacks and values a field cannot take, and writes nothing for them', () => {
		const f = form();
		const result = fillForm(f, { nope: 1, secret: 'y', kind: 'other', requirement_ids: ['r9'], test_id: 'MUCH-TOO-LONG-ID' });
		expect(result).toEqual({ applied: [], ignored: ['nope', 'secret', 'kind', 'requirement_ids', 'test_id'] });
		expect(new FormData(f).getAll('requirement_ids')).toEqual(['r2']);
	});
});

describe('describeForm', () => {
	it('lists each field with what it takes and its value now', () => {
		const text = describeForm(form(), 'Add a test');
		expect(text).toContain('- test_id (Test ID): text, up to 10 characters, required; now empty');
		expect(text).toContain('- kind: one of "automated", "evidence"; now "automated"');
		expect(text).toContain('- mandatory: true or false (Mandatory); now true');
		expect(text).toContain('- requirement_ids: a list of the values to tick, from: "r1" = DEMO 1.1 Consents; "r2" = DEMO 1.2 Status [ticked]');
		expect(text).not.toContain('secret');
	});
});
