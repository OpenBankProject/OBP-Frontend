import { describe, expect, it } from 'vitest';
import { columnWidths, latin1, tablePdf, textWidth, wrap } from './pdf';

const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);

describe('tablePdf', () => {
	it('writes a PDF with the title, the headers and the cells, and a correct cross-reference table', () => {
		const pdf = text(tablePdf({ title: 'Applications by call', headers: ['call', 'submitted'], rows: [['Spring (2027)', 4], ['Café', null]] }, new Date('2026-11-03T06:00:00Z')));
		expect(pdf.startsWith('%PDF-1.4')).toBe(true);
		expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
		expect(pdf).toContain('(Applications by call) Tj');
		expect(pdf).toContain('(Generated 2026-11-03 06:00 UTC) Tj');
		expect(pdf).toContain('(Spring \\(2027\\)) Tj');
		expect(pdf).toContain('(Caf\xe9) Tj');
		expect(pdf).toContain('(Page 1 of 1) Tj');
		// Each object starts where the cross-reference table says it does.
		const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
		offsets.forEach((o, i) => expect(pdf.startsWith(`${i + 1} 0 obj\n`, o)).toBe(true));
		const startxref = Number(pdf.match(/startxref\n(\d+)/)![1]);
		expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
	});

	it('puts many rows on several pages, each with the header', () => {
		const rows = Array.from({ length: 120 }, (_, i) => [`Startup ${i}`, i]);
		const pdf = text(tablePdf({ title: 'Startups', headers: ['startup', 'sessions'], rows }));
		const pages = Number(pdf.match(/\/Count (\d+)/)![1]);
		expect(pages).toBeGreaterThan(1);
		expect(pdf.match(/\(startup\) Tj/g)!.length).toBe(pages);
		expect(pdf).toContain(`(Page ${pages} of ${pages}) Tj`);
	});

	it('says so when there are no rows', () => {
		expect(text(tablePdf({ title: 'Empty', headers: ['a'], rows: [] }))).toContain('(No rows.) Tj');
	});
});

describe('latin1', () => {
	it('keeps Latin-1, maps typographic punctuation and prints other characters as "?"', () => {
		expect(latin1('Zoë’s “plan” – ok')).toBe('Zo\xeb\'s "plan" - ok');
		expect(latin1('شركة')).toBe('????');
	});
});

describe('wrap and columnWidths', () => {
	it('wraps at spaces, breaks words longer than a line, and keeps line breaks', () => {
		const width = textWidth('aaaa aaaa', 8);
		expect(wrap('aaaa aaaa aaaa', width, 8)).toEqual(['aaaa aaaa', 'aaaa']);
		expect(wrap('a'.repeat(20), textWidth('a'.repeat(10), 8), 8)).toEqual(['a'.repeat(10), 'a'.repeat(10)]);
		expect(wrap('one\ntwo', 1000, 8)).toEqual(['one', 'two']);
	});

	it('keeps narrow columns and shares what is left among the wide ones', () => {
		expect(columnWidths([10, 20], 100)).toEqual([10, 20]);
		expect(columnWidths([10, 200, 300], 110)).toEqual([10, 50, 50]);
	});
});
