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
import type { Locale } from '$lib/i18n';

/**
 * The form builder's forms: an application form's extra questions for a call, or a survey for a programme's startups.
 * Questions are kept on the form record as JSON while it is a draft. Publishing makes the form its own dynamic entity,
 * one property per question, so answers are typed and filterable; from then on the form only grows: questions are
 * added or hidden, never removed or retyped, and a bigger change is a new version.
 */

export const QUESTION_KINDS = ['text', 'textarea', 'number', 'select', 'checkbox', 'date'] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];
export const FORM_PURPOSES = ['application', 'survey'] as const;
export type FormPurpose = (typeof FORM_PURPOSES)[number];
export type FormStatus = 'draft' | 'published' | 'closed';

/** An answer choice, in both languages. Its English text is the value stored. */
export interface QuestionOption {
	en: string;
	ar: string;
}

export interface Question {
	/** The property of the form's dynamic entity: set once, never renamed. */
	key: string;
	kind: QuestionKind;
	label: string;
	label_ar: string;
	help?: string;
	help_ar?: string;
	options?: QuestionOption[];
	required?: boolean;
	/** In the published dynamic entity, so it can no longer be removed or retyped. */
	published?: boolean;
	/** No longer asked; answers already given are still shown. */
	hidden?: boolean;
}

export type Answer = string | number | boolean;
export type Answers = Record<string, Answer>;

export interface Form {
	id: string;
	purpose: FormPurpose;
	title: string;
	title_ar: string;
	description: string;
	description_ar: string;
	call_id: string;
	programme_id: string;
	status: FormStatus;
	version: number;
	questions: Question[];
	entity_name: string;
	dynamic_entity_id: string;
	published_at: string;
	/** The earlier version this one replaces: publishing closes it. */
	replaces_form_id: string;
}

/** Properties every answers record has, so no question may take their names. */
export const RESERVED_KEYS = ['subject_id', 'startup_name', 'submitted_at'];

const isKind = (v: unknown): v is QuestionKind => (QUESTION_KINDS as readonly string[]).includes(String(v));

/** The questions kept on a form record; anything unreadable is left out. */
export function parseQuestions(json: unknown): Question[] {
	let raw: unknown;
	try {
		raw = typeof json === 'string' ? JSON.parse(json || '[]') : json;
	} catch {
		return [];
	}
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((q) => q && typeof q.key === 'string' && /^[a-z][a-z0-9_]*$/.test(q.key) && isKind(q.kind))
		.map((q) => ({
			key: q.key,
			kind: q.kind,
			label: String(q.label ?? ''),
			label_ar: String(q.label_ar ?? ''),
			...(q.help ? { help: String(q.help) } : {}),
			...(q.help_ar ? { help_ar: String(q.help_ar) } : {}),
			...(q.kind === 'select' ? { options: Array.isArray(q.options) ? q.options.map((o: any) => ({ en: String(o?.en ?? ''), ar: String(o?.ar ?? '') })).filter((o: QuestionOption) => o.en) : [] } : {}),
			...(q.required ? { required: true } : {}),
			...(q.published ? { published: true } : {}),
			...(q.hidden ? { hidden: true } : {})
		}));
}

export function formOf(id: string, r: Record<string, unknown>): Form {
	const purpose = r.purpose === 'survey' ? 'survey' : 'application';
	const status = r.status === 'published' || r.status === 'closed' ? r.status : 'draft';
	return {
		id,
		purpose,
		title: String(r.title ?? ''),
		title_ar: String(r.title_ar ?? ''),
		description: String(r.description ?? ''),
		description_ar: String(r.description_ar ?? ''),
		call_id: String(r.call_id ?? ''),
		programme_id: String(r.programme_id ?? ''),
		status,
		version: Number(r.version) || 1,
		questions: parseQuestions(r.questions),
		entity_name: String(r.entity_name ?? ''),
		dynamic_entity_id: String(r.dynamic_entity_id ?? ''),
		published_at: String(r.published_at ?? ''),
		replaces_form_id: String(r.replaces_form_id ?? '')
	};
}

/** The dynamic entity a form is published as: Cohort's prefix and the start of the form's id. */
export function entityNameFor(formId: string): string {
	return `cohort_form_${formId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`;
}

/** A new question's key: its English label in snake_case, or `question_<n>`, never one already taken. */
export function keyFor(label: string, taken: string[]): string {
	const slug = label
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^[^a-z]+/, '')
		.replace(/_+$/, '')
		.slice(0, 40)
		.replace(/_+$/, '');
	const base = slug || 'question';
	const used = new Set([...taken, ...RESERVED_KEYS]);
	if (slug && !used.has(base)) return base;
	for (let n = 1; ; n++) if (!used.has(`${base}_${n}`)) return `${base}_${n}`;
}

/** Answer choices from the builder's text box: one a line, English then Arabic, split by `|`. */
export function parseOptions(text: string): QuestionOption[] {
	return text
		.split('\n')
		.map((line) => line.split('|').map((s) => s.trim()))
		.filter(([en]) => en)
		.map(([en, ar]) => ({ en: en.slice(0, 255), ar: (ar ?? '').slice(0, 255) }));
}

export function optionsText(options: QuestionOption[] = []): string {
	return options.map((o) => (o.ar ? `${o.en} | ${o.ar}` : o.en)).join('\n');
}

/** Text in the User's language, falling back to the other when it is the only one written. */
export const inLocale = (locale: Locale, en: string, ar: string) => (locale === 'ar' ? ar || en : en || ar);

export const questionLabel = (q: Question, locale: Locale) => inLocale(locale, q.label, q.label_ar);
export const questionHelp = (q: Question, locale: Locale) => inLocale(locale, q.help ?? '', q.help_ar ?? '');
export const formTitle = (f: Pick<Form, 'title' | 'title_ar'>, locale: Locale) => inLocale(locale, f.title, f.title_ar);

/** The questions still asked, in order. */
export const askedQuestions = (questions: Question[]) => questions.filter((q) => !q.hidden);

/** The input's name for a question on a rendered form. */
export const fieldName = (q: Question) => `q_${q.key}`;

/** The answers from a submitted form, for the questions still asked; empty and unreadable answers are left out. */
export function readAnswers(questions: Question[], form: FormData): Answers {
	const answers: Answers = {};
	for (const q of askedQuestions(questions)) {
		const raw = form.get(fieldName(q));
		if (q.kind === 'checkbox') {
			answers[q.key] = raw === 'on' || raw === 'true';
			continue;
		}
		const text = String(raw ?? '').trim();
		if (!text) continue;
		if (q.kind === 'number') {
			const n = Number(text);
			if (Number.isFinite(n)) answers[q.key] = Math.trunc(n);
		} else if (q.kind === 'select') {
			if (q.options?.some((o) => o.en === text)) answers[q.key] = text;
		} else if (q.kind === 'date') {
			if (/^\d{4}-\d{2}-\d{2}$/.test(text)) answers[q.key] = text;
		} else {
			answers[q.key] = text.slice(0, q.kind === 'textarea' ? 4000 : 255);
		}
	}
	return answers;
}

/** The required questions still asked that have no answer. A required checkbox must be ticked. */
export function missingAnswers(questions: Question[], answers: Answers): Question[] {
	return askedQuestions(questions).filter((q) => {
		if (!q.required) return false;
		const a = answers[q.key];
		return q.kind === 'checkbox' ? a !== true : a === undefined || String(a).trim() === '';
	});
}

/** An answer as the reader sees it: a choice in their language, a tick for yes. */
export function answerText(q: Question, value: unknown, locale: Locale): string {
	if (value === undefined || value === null || value === '') return '';
	if (q.kind === 'checkbox') return value === true || value === 'true' ? '✓' : '—';
	if (q.kind === 'select') {
		const option = q.options?.find((o) => o.en === value);
		return option ? inLocale(locale, option.en, option.ar) : String(value);
	}
	return String(value);
}

/** The answers in a record of the form's dynamic entity. */
export function answersOf(questions: Question[], record: Record<string, unknown> | null | undefined): Answers {
	const answers: Answers = {};
	for (const q of questions) {
		const v = record?.[q.key];
		if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') answers[q.key] = v;
	}
	return answers;
}

/**
 * Why the edited questions cannot replace the published ones, or null when they can: every published question must
 * still be there, with its kind.
 */
export function growthProblem(before: Question[], after: Question[]): string | null {
	for (const q of before.filter((q) => q.published)) {
		const now = after.find((a) => a.key === q.key);
		if (!now) return `removed:${q.key}`;
		if (now.kind !== q.kind) return `retyped:${q.key}`;
	}
	return null;
}

export type QuestionSummary =
	| { key: string; kind: 'select' | 'checkbox'; answered: number; counts: { label: string; count: number }[] }
	| { key: string; kind: 'number'; answered: number; average: number | null; min: number | null; max: number | null }
	| { key: string; kind: 'text' | 'textarea' | 'date'; answered: number; answers: string[] };

/** What the responses say, question by question: counts of each choice, the range and average of numbers, the texts. */
export function summarise(questions: Question[], responses: Answers[], locale: Locale): QuestionSummary[] {
	return questions.map((q) => {
		const given = responses.map((r) => r[q.key]).filter((v) => v !== undefined && v !== '');
		if (q.kind === 'select') {
			const counts = (q.options ?? []).map((o) => ({ label: inLocale(locale, o.en, o.ar), count: given.filter((v) => v === o.en).length }));
			return { key: q.key, kind: q.kind, answered: given.length, counts };
		}
		if (q.kind === 'checkbox') {
			const yes = given.filter((v) => v === true).length;
			return { key: q.key, kind: q.kind, answered: given.length, counts: [{ label: '✓', count: yes }, { label: '—', count: given.length - yes }] };
		}
		if (q.kind === 'number') {
			const numbers = given.map(Number).filter(Number.isFinite);
			const average = numbers.length ? Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 10) / 10 : null;
			return { key: q.key, kind: q.kind, answered: numbers.length, average, min: numbers.length ? Math.min(...numbers) : null, max: numbers.length ? Math.max(...numbers) : null };
		}
		return { key: q.key, kind: q.kind, answered: given.length, answers: given.map(String) };
	});
}
