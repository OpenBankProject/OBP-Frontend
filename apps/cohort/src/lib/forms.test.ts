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
import { describe, expect, it } from 'vitest';
import { answerText, entityNameFor, formOf, growthProblem, keyFor, missingAnswers, parseOptions, parseQuestions, readAnswers, summarise, type Question } from './forms';

const funding: Question = { key: 'funding_raised', kind: 'number', label: 'Funding raised', label_ar: 'التمويل المحصّل', required: true, published: true };
const round: Question = { key: 'round', kind: 'select', label: 'Round', label_ar: 'الجولة', options: [{ en: 'Seed', ar: 'تمويل أولي' }, { en: 'Series A', ar: 'الجولة أ' }] };
const pilot: Question = { key: 'pilot', kind: 'checkbox', label: 'Has a pilot customer', label_ar: 'لديها عميل تجريبي', required: true };
const old: Question = { key: 'old', kind: 'text', label: 'No longer asked', label_ar: '', hidden: true, published: true };

function formData(entries: Record<string, string>) {
	const data = new FormData();
	for (const [k, v] of Object.entries(entries)) data.set(k, v);
	return data;
}

describe('keyFor', () => {
	it('makes a property name from the English label', () => {
		expect(keyFor('Funding raised (OMR)?', [])).toBe('funding_raised_omr');
	});
	it('never reuses a key or takes a reserved one', () => {
		expect(keyFor('Funding raised', ['funding_raised'])).toBe('funding_raised_1');
		expect(keyFor('Submitted at', [])).toBe('submitted_at_1');
	});
	it('numbers a question with no English label, such as one written only in Arabic', () => {
		expect(keyFor('', [])).toBe('question_1');
		expect(keyFor('2027 plans', [])).toBe('plans');
	});
});

describe('parseOptions', () => {
	it('reads one choice a line, English then Arabic', () => {
		expect(parseOptions('Seed | تمويل أولي\n\nSeries A')).toEqual([
			{ en: 'Seed', ar: 'تمويل أولي' },
			{ en: 'Series A', ar: '' }
		]);
	});
});

describe('parseQuestions', () => {
	it('keeps only readable questions', () => {
		const json = JSON.stringify([funding, { key: 'Bad Key', kind: 'text' }, { key: 'x', kind: 'colour' }, round]);
		expect(parseQuestions(json).map((q) => q.key)).toEqual(['funding_raised', 'round']);
		expect(parseQuestions('not json')).toEqual([]);
	});
	it('is read from a form record', () => {
		const form = formOf('abc', { purpose: 'survey', title: 'Mid-programme', status: 'published', questions: JSON.stringify([funding]), version: 2 });
		expect(form).toMatchObject({ id: 'abc', purpose: 'survey', status: 'published', version: 2 });
		expect(form.questions[0].key).toBe('funding_raised');
	});
});

describe('readAnswers and missingAnswers', () => {
	const questions = [funding, round, pilot, old];
	it('reads typed answers to the questions still asked', () => {
		const answers = readAnswers(questions, formData({ q_funding_raised: '25000', q_round: 'Seed', q_pilot: 'on', q_old: 'ignored' }));
		expect(answers).toEqual({ funding_raised: 25000, round: 'Seed', pilot: true });
	});
	it('drops a choice that is not offered and a number that is not one', () => {
		expect(readAnswers(questions, formData({ q_funding_raised: 'lots', q_round: 'Series Z' }))).toEqual({ pilot: false });
	});
	it('lists the required questions not answered; a required checkbox must be ticked', () => {
		expect(missingAnswers(questions, { pilot: false }).map((q) => q.key)).toEqual(['funding_raised', 'pilot']);
		expect(missingAnswers(questions, { funding_raised: 0, pilot: true })).toEqual([]);
	});
});

describe('answerText', () => {
	it('shows a choice in the reader\'s language', () => {
		expect(answerText(round, 'Seed', 'ar')).toBe('تمويل أولي');
		expect(answerText(round, 'Seed', 'en')).toBe('Seed');
		expect(answerText(pilot, true, 'en')).toBe('✓');
	});
});

describe('growthProblem', () => {
	it('lets a published form grow and keeps its published questions as they were', () => {
		expect(growthProblem([funding], [funding, round])).toBeNull();
		expect(growthProblem([funding], [round])).toBe('removed:funding_raised');
		expect(growthProblem([funding], [{ ...funding, kind: 'text' }])).toBe('retyped:funding_raised');
		expect(growthProblem([round], [])).toBeNull();
	});
});

describe('entityNameFor', () => {
	it('is a valid dynamic entity name from the form id', () => {
		expect(entityNameFor('6FB17583-1e49-4435')).toBe('cohort_form_6fb175831e49');
	});
});

describe('summarise', () => {
	it('counts choices, averages numbers and lists texts', () => {
		const text: Question = { key: 'notes', kind: 'textarea', label: 'Notes', label_ar: '' };
		const [f, r, p, n] = summarise([funding, round, pilot, text], [
			{ funding_raised: 10, round: 'Seed', pilot: true, notes: 'Good' },
			{ funding_raised: 25, round: 'Seed', pilot: false },
			{ round: 'Series A' }
		], 'en');
		expect(f).toMatchObject({ answered: 2, average: 17.5, min: 10, max: 25 });
		expect(r).toMatchObject({ answered: 3, counts: [{ label: 'Seed', count: 2 }, { label: 'Series A', count: 1 }] });
		expect(p).toMatchObject({ answered: 2, counts: [{ label: '✓', count: 1 }, { label: '—', count: 1 }] });
		expect(n).toMatchObject({ answered: 1, answers: ['Good'] });
	});
});
