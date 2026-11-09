import { describe, expect, it } from 'vitest';
import { normalise, search, type SearchItem } from './search';

const items: SearchItem[] = [
	{ kind: 'call', id: 'c1', title: 'Spring payments call', text: 'For payment startups', href: '/calls/c1', date: '2027-03-01' },
	{ kind: 'programme', id: 'p1', title: 'Accelerator', text: 'Payments and lending, six months', href: '/', date: '2027-01-01' },
	{ kind: 'startup', id: 's1', title: 'شركة المدفوعات', text: 'مسرعة الأعمال', href: '/staff/participants', date: '2027-02-01', stage: 'in_programme' },
	{ kind: 'application', id: 'a1', title: 'Lendwell', text: 'lending', href: '/staff/applications/a1', date: '2027-02-15', stage: 'submitted' }
];

describe('normalise', () => {
	it('unifies Arabic letter forms and drops diacritics and tatweel', () => {
		expect(normalise('أحمد إبراهيم آمنة')).toBe('احمد ابراهيم امنه');
		expect(normalise('مُسَرِّعة')).toBe('مسرعه');
		expect(normalise('مـسـرعة')).toBe('مسرعه');
		expect(normalise('  Café  PAYMENTS ')).toBe('cafe payments');
	});
});

describe('search', () => {
	it('needs every word, and ranks title matches above text matches', () => {
		expect(search(items, 'payments').map((h) => h.id)).toEqual(['c1', 'p1']);
		expect(search(items, 'payments lending').map((h) => h.id)).toEqual(['p1']);
		expect(search(items, '')).toEqual([]);
	});

	it('finds Arabic whatever form was typed', () => {
		expect(search(items, 'مسرعه').map((h) => h.id)).toEqual(['s1']);
		expect(search(items, 'المدفوعات').map((h) => h.id)).toEqual(['s1']);
	});

	it('filters by kind and stage, and sorts by date when asked', () => {
		expect(search(items, 'lending', { kind: 'application' }).map((h) => h.id)).toEqual(['a1']);
		expect(search(items, 'شركة', { stage: 'graduated' })).toEqual([]);
		expect(search(items, 'lending', { sort: 'date' }).map((h) => h.id)).toEqual(['a1', 'p1']);
	});
});
