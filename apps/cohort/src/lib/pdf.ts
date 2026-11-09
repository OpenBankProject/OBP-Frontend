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
 * A report table as a PDF: A4 landscape, the title and when it was made, then the table, its header repeated on every
 * page, long cells wrapped. Written by hand with PDF's built-in Helvetica, so it needs no library and no font files.
 * Helvetica covers Latin text only: any other character (Arabic, for one) is printed as "?".
 */

export type Cell = string | number | boolean | null;

export interface Table {
	title: string;
	headers: string[];
	rows: Cell[][];
}

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 40;
const FONT_SIZE = 8;
const LINE_H = 10;
const PAD = 3;
/** A row taller than this many lines is cut, so that one row always fits on a page. */
const MAX_LINES = 30;

/** Helvetica's advance widths (per 1000 units of font size) for the characters 32 to 126. */
const HELVETICA = [
	278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
	556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
	667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
	556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];

const PUNCTUATION: Record<string, string> = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', ' ': ' ' };

/** The text in the characters Helvetica can print (Latin-1, as WinAnsiEncoding), anything else as "?". */
export function latin1(text: string): string {
	return [...text.replace(/\r\n?/g, '\n')]
		.map((c) => PUNCTUATION[c] ?? c)
		.join('')
		.replace(/[^\n\x20-\x7e\xa0-\xff]/g, '?');
}

/** How wide the text is, in points, at the given size; bold is taken as a little wider. */
export function textWidth(text: string, size: number, bold = false): number {
	let units = 0;
	for (const c of text) {
		const code = c.charCodeAt(0);
		units += code >= 32 && code <= 126 ? HELVETICA[code - 32] : 556;
	}
	return (units * size * (bold ? 1.08 : 1)) / 1000;
}

/** The text in lines no wider than width: broken at spaces, and inside words longer than a line. */
export function wrap(text: string, width: number, size: number, bold = false): string[] {
	const lines: string[] = [];
	for (const paragraph of text.split('\n')) {
		let line = '';
		for (const word of paragraph.split(/ +/)) {
			const candidate = line ? `${line} ${word}` : word;
			if (textWidth(candidate, size, bold) <= width) {
				line = candidate;
				continue;
			}
			if (line) lines.push(line);
			line = '';
			if (textWidth(word, size, bold) <= width) {
				line = word;
				continue;
			}
			for (const c of word) {
				if (line && textWidth(line + c, size, bold) > width) {
					lines.push(line);
					line = '';
				}
				line += c;
			}
		}
		lines.push(line);
	}
	return lines;
}

const cellText = (v: Cell) => latin1(v === null ? '' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));

/**
 * Each column's width: its widest content if every column fits, otherwise columns narrower than a fair share keep
 * their width and the rest share what is left equally.
 */
export function columnWidths(natural: number[], available: number): number[] {
	const total = natural.reduce((a, b) => a + b, 0);
	if (total <= available) return natural;
	const widths: (number | null)[] = natural.map(() => null);
	let left = available;
	for (;;) {
		const open = widths.flatMap((w, i) => (w === null ? [i] : []));
		const share = left / open.length;
		const fitting = open.filter((i) => natural[i] <= share);
		if (fitting.length === 0) {
			for (const i of open) widths[i] = share;
			return widths as number[];
		}
		for (const i of fitting) {
			widths[i] = natural[i];
			left -= natural[i];
		}
	}
}

/** A PDF string literal: Latin-1 text with its special characters escaped. */
const pdfString = (text: string) => `(${text.replace(/[\\()]/g, (c) => `\\${c}`)})`;
const num = (n: number) => String(Math.round(n * 100) / 100);

interface LaidRow {
	lines: string[][];
	height: number;
}

/** The table as a PDF file. generatedAt is printed under the title (an ISO date and time, shown in UTC). */
export function tablePdf(table: Table, generatedAt = new Date()): Uint8Array<ArrayBuffer> {
	const headers = table.headers.map((h) => latin1(h));
	const rows = table.rows.map((r) => headers.map((_, i) => cellText(r[i] ?? null)));
	const numeric = headers.map((_, i) => table.rows.length > 0 && table.rows.every((r) => typeof r[i] === 'number' || r[i] === null));

	const natural = headers.map((h, i) =>
		Math.max(textWidth(h, FONT_SIZE, true), ...rows.map((r) => Math.max(...r[i].split('\n').map((l) => textWidth(l, FONT_SIZE))))) + 2 * PAD + 1
	);
	const widths = columnWidths(natural, PAGE_W - 2 * MARGIN);

	const layout = (cells: string[], bold: boolean): LaidRow => {
		const lines = cells.map((c, i) => {
			const wrapped = wrap(c, widths[i] - 2 * PAD, FONT_SIZE, bold);
			return wrapped.length > MAX_LINES ? [...wrapped.slice(0, MAX_LINES - 1), '...'] : wrapped;
		});
		return { lines, height: Math.max(1, ...lines.map((l) => l.length)) * LINE_H + 2 * PAD };
	};
	const header = layout(headers, true);
	const body = rows.map((r) => layout(r, false));

	// Split the rows into pages: the first page also holds the title.
	const top = PAGE_H - MARGIN;
	const titleHeight = 34;
	const bottom = MARGIN + 14;
	const pages: LaidRow[][] = [[]];
	let y = top - titleHeight - header.height;
	for (const row of body) {
		if (y - row.height < bottom && pages[pages.length - 1].length > 0) {
			pages.push([]);
			y = top - header.height;
		}
		pages[pages.length - 1].push(row);
		y -= row.height;
	}

	const generated = `Generated ${generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
	const contents = pages.map((pageRows, p) => {
		const ops: string[] = [];
		let y = top;
		if (p === 0) {
			ops.push(`BT /F2 14 Tf ${MARGIN} ${num(y - 14)} Td ${pdfString(latin1(table.title))} Tj ET`);
			ops.push(`BT /F1 9 Tf ${MARGIN} ${num(y - 27)} Td ${pdfString(generated)} Tj ET`);
			y -= titleHeight;
		}
		const drawRow = (row: LaidRow, bold: boolean) => {
			if (bold) ops.push(`0.9 g ${MARGIN} ${num(y - row.height)} ${num(widths.reduce((a, b) => a + b, 0))} ${num(row.height)} re f 0 g`);
			let x = MARGIN;
			row.lines.forEach((lines, i) => {
				lines.forEach((line, l) => {
					const right = !bold && numeric[i];
					const tx = right ? x + widths[i] - PAD - textWidth(line, FONT_SIZE) : x + PAD;
					const ty = y - PAD - (l + 1) * LINE_H + 2;
					ops.push(`BT /F${bold ? 2 : 1} ${FONT_SIZE} Tf ${num(tx)} ${num(ty)} Td ${pdfString(line)} Tj ET`);
				});
				x += widths[i];
			});
			y -= row.height;
			ops.push(`0.75 G 0.5 w ${MARGIN} ${num(y)} m ${num(MARGIN + widths.reduce((a, b) => a + b, 0))} ${num(y)} l S`);
		};
		drawRow(header, true);
		for (const row of pageRows) drawRow(row, false);
		if (rows.length === 0 && p === 0) ops.push(`BT /F1 ${FONT_SIZE} Tf ${MARGIN + PAD} ${num(y - LINE_H - PAD)} Td (No rows.) Tj ET`);
		ops.push(`BT /F1 8 Tf ${MARGIN} ${MARGIN} Td ${pdfString(`Page ${p + 1} of ${pages.length}`)} Tj ET`);
		return ops.join('\n');
	});

	// Objects: 1 catalog, 2 pages, 3 and 4 the fonts, 5 the document information, then a page and its content each.
	const pageIds = pages.map((_, p) => 6 + 2 * p);
	const objects: string[] = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
		`<< /Title ${pdfString(latin1(table.title))} /Producer (OBP-Cohort) /CreationDate (D:${generatedAt.toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`
	];
	contents.forEach((content, p) => {
		objects.push(
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[p] + 1} 0 R >>`,
			`<< /Length ${content.length} >>\nstream\n${content}\nendstream`
		);
	});

	// Every character is below 256, so a string's length is its length in bytes and the offsets are exact.
	let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
	const offsets: number[] = [];
	objects.forEach((body, i) => {
		offsets.push(out.length);
		out += `${i + 1} 0 obj\n${body}\nendobj\n`;
	});
	const xref = out.length;
	out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
	out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	const bytes = new Uint8Array(out.length);
	for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i);
	return bytes;
}
