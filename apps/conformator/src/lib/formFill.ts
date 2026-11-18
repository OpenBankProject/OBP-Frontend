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

/**
 * Lets Opey fill in a plain HTML form on the page (its set_form_fields tool), and tells it what the form holds. It
 * writes values the way typing would, and sends input and change events, so the page's own bindings follow. It never
 * submits: the User checks the values and presses the button.
 */

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export interface FillResult {
	/** Field names that were written. */
	applied: string[];
	/** Names the form does not have, or values it cannot take, so Opey can correct itself. */
	ignored: string[];
}

/** The form's fields, by name, in page order. Buttons and hidden fields are left out. */
function fieldsByName(form: HTMLFormElement): Map<string, Field[]> {
	const out = new Map<string, Field[]>();
	for (const el of Array.from(form.elements)) {
		if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
		if (!el.name || (el instanceof HTMLInputElement && ['hidden', 'submit', 'button', 'reset', 'file'].includes(el.type))) continue;
		out.set(el.name, [...(out.get(el.name) ?? []), el]);
	}
	return out;
}

/** The text by a checkbox or radio button: its label, without the box itself. */
function labelOf(el: HTMLInputElement): string {
	return (el.closest('label')?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function changed(el: Field): void {
	el.dispatchEvent(new Event('input', { bubbles: true }));
	el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Write the given values into the form. A text field takes text (an object or list is written as JSON, for a field
 * such as a test's definition). A select or a group of radio buttons takes one of its values. A single checkbox takes
 * true or false. A group of checkboxes takes the list of values to tick; the others are cleared.
 */
export function fillForm(form: HTMLFormElement, values: Record<string, unknown>): FillResult {
	const fields = fieldsByName(form);
	const result: FillResult = { applied: [], ignored: [] };
	for (const [name, value] of Object.entries(values)) {
		const group = fields.get(name);
		if (!group) {
			result.ignored.push(name);
			continue;
		}
		const first = group[0];
		let ok = false;
		if (first instanceof HTMLInputElement && first.type === 'checkbox') {
			if (group.length === 1 && typeof value === 'boolean') {
				first.checked = value;
				changed(first);
				ok = true;
			} else if (Array.isArray(value)) {
				const wanted = new Set(value.map(String));
				const known = new Set(group.map((el) => el.value));
				ok = [...wanted].every((v) => known.has(v));
				if (ok)
					for (const el of group as HTMLInputElement[]) {
						el.checked = wanted.has(el.value);
						changed(el);
					}
			}
		} else if (first instanceof HTMLInputElement && first.type === 'radio') {
			const target = (group as HTMLInputElement[]).find((el) => el.value === String(value));
			if (target) {
				target.checked = true;
				changed(target);
				ok = true;
			}
		} else if (first instanceof HTMLSelectElement) {
			if (Array.from(first.options).some((o) => o.value === String(value))) {
				first.value = String(value);
				changed(first);
				ok = true;
			}
		} else if (value !== null && value !== undefined) {
			const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
			const max = (first as HTMLInputElement | HTMLTextAreaElement).maxLength;
			if (max <= 0 || text.length <= max) {
				first.value = text;
				changed(first);
				ok = true;
			}
		}
		(ok ? result.applied : result.ignored).push(name);
	}
	return result;
}

/** What the form holds, for Opey: each field, what it takes and its current value. */
export function describeForm(form: HTMLFormElement, title: string): string {
	const lines = [`The form "${title}" has these fields (set them with set_form_fields, by name):`];
	for (const [name, group] of fieldsByName(form)) {
		const first = group[0];
		const label = (first.closest('label')?.querySelector('span')?.textContent ?? '').trim();
		const about = label ? ` (${label})` : '';
		if (first instanceof HTMLInputElement && first.type === 'checkbox' && group.length > 1) {
			const options = (group as HTMLInputElement[]).map((el) => `"${el.value}" = ${labelOf(el)}${el.checked ? ' [ticked]' : ''}`);
			lines.push(`- ${name}: a list of the values to tick, from: ${options.join('; ')}`);
		} else if (first instanceof HTMLInputElement && first.type === 'checkbox') {
			lines.push(`- ${name}: true or false (${labelOf(first)}); now ${first.checked}`);
		} else if (first instanceof HTMLInputElement && first.type === 'radio') {
			const options = (group as HTMLInputElement[]).map((el) => `"${el.value}"${el.checked ? ' [chosen]' : ''}`);
			lines.push(`- ${name}: one of ${options.join(', ')}`);
		} else if (first instanceof HTMLSelectElement) {
			const options = Array.from(first.options).filter((o) => !o.disabled).map((o) => `"${o.value}"`);
			lines.push(`- ${name}${about}: one of ${options.join(', ')}; now "${first.value}"`);
		} else {
			const max = (first as HTMLInputElement | HTMLTextAreaElement).maxLength;
			const value = first.value ? JSON.stringify(first.value) : 'empty';
			lines.push(`- ${name}${about}: text${max > 0 ? `, up to ${max} characters` : ''}${first.required ? ', required' : ''}; now ${value}`);
		}
	}
	return lines.join('\n');
}
