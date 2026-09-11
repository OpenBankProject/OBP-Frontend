/*
 * Copyright (C) 2025-2026 TESOBE GmbH
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
 * Splitting an endpoint description into prose and its field reference.
 *
 * OBP appends a glossary of every body field to most descriptions, under a
 * `**JSON response body fields:**` (or request) heading, one field per paragraph:
 *
 *     [**bank_id**](/glossary#Bank.bank_id): gh.29.uk
 *
 * That is 866 of 1232 endpoints, and a median 41% of the description text. Rendered as
 * markdown it becomes a wall of bold, underlined, blank-line-separated paragraphs that
 * drowns the two or three sentences actually explaining the endpoint. Pulled out into a
 * list of fields it can be laid out as a reference table and folded away.
 *
 * Nothing is discarded: a line inside a section that is not a field lands in `extra`.
 */

export interface DescriptionField {
	name: string;
	/** The glossary entry for the term, when the description links one. */
	glossaryHref?: string;
	text: string;
}

export interface DescriptionSection {
	/** e.g. "JSON response body fields". */
	title: string;
	fields: DescriptionField[];
	/** Lines in the section that were not field definitions, as markdown. */
	extra: string;
}

export interface ParsedDescription {
	/** The description with its field sections removed, still markdown. */
	prose: string;
	sections: DescriptionSection[];
}

/** A section heading: a whole line that is just bold text ending in "fields:". */
const SECTION_HEADING = /^\s*\*\*\s*(.+?fields)\s*:?\s*\*\*\s*$/i;

/** `[**name**](href): text`, `**name**: text`, `[name](href): text` or `name: text`. */
const FIELD_LINE = /^\s*(?:\[\s*(?:\*\*)?(.+?)(?:\*\*)?\s*\]\((\S+?)\)|(?:\*\*)?([^*:[\]]+?)(?:\*\*)?)\s*:\s*(.*)$/;

function parseFieldLine(line: string): DescriptionField | null {
	const match = line.match(FIELD_LINE);
	if (!match) return null;
	const name = (match[1] ?? match[3] ?? '').trim();
	if (!name) return null;
	return { name, glossaryHref: match[2], text: (match[4] ?? '').trim() };
}

export function parseDescription(markdown: string): ParsedDescription {
	if (!markdown) return { prose: '', sections: [] };

	const proseLines: string[] = [];
	const sections: DescriptionSection[] = [];
	let current: { title: string; fields: DescriptionField[]; extra: string[] } | null = null;

	for (const line of markdown.split('\n')) {
		const heading = line.match(SECTION_HEADING);
		if (heading) {
			if (current) sections.push({ ...current, extra: current.extra.join('\n').trim() });
			current = { title: heading[1].trim(), fields: [], extra: [] };
			continue;
		}

		if (!current) {
			proseLines.push(line);
			continue;
		}

		if (!line.trim()) continue;
		const field = parseFieldLine(line);
		if (field) current.fields.push(field);
		else current.extra.push(line);
	}

	if (current) sections.push({ ...current, extra: current.extra.join('\n').trim() });

	return { prose: proseLines.join('\n').trim(), sections };
}

/**
 * Glossary links in descriptions are site-relative to the API Explorer
 * (`/glossary#bank_id`), so they 404 anywhere else. Point them at a base that serves one.
 */
export function resolveGlossaryHref(href: string | undefined, glossaryBaseUrl: string): string | undefined {
	if (!href) return undefined;
	if (!href.startsWith('/glossary#')) return href;
	return `${glossaryBaseUrl.replace(/\/$/, '')}${href}`;
}
