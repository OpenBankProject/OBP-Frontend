/*
 * Copyright (C) 2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Message = string | Array<{ declarations: string[]; match: Record<string, string> }>;

/** One language's messages, from packages/shared/messages/<locale>.json, without the $schema line. */
function messages(locale: string): Record<string, Message> {
	const { $schema: _schema, ...rest } = JSON.parse(readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url), 'utf-8'));
	return rest;
}

/** The {placeholders} in a text, sorted, e.g. ['count', 'name']. */
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

/** What a message takes: the {placeholders} of a plain message, or the declared inputs of a counting (plural) message. */
function inputs(message: Message): string[] {
	if (typeof message === 'string') return placeholders(message);
	return message.flatMap((variant) => variant.declarations.filter((line) => line.startsWith('input ')).map((line) => line.slice(6).trim())).sort();
}

/** Every text in a message: itself, or each form of a counting message. */
const texts = (message: Message): string[] => (typeof message === 'string' ? [message] : message.flatMap((variant) => Object.values(variant.match)));

describe('the message files', () => {
	const english = messages('en');
	const arabic = messages('ar');

	it('have the same keys in English and Arabic', () => {
		expect(Object.keys(arabic).sort()).toEqual(Object.keys(english).sort());
	});

	it('take the same inputs in each language', () => {
		const different = Object.keys(english).filter((key) => arabic[key] !== undefined && inputs(english[key]).join() !== inputs(arabic[key]).join());
		expect(different).toEqual([]);
	});

	it('use only declared inputs in each form of a counting message', () => {
		const wrong = [...Object.entries(english), ...Object.entries(arabic)].filter(
			([, message]) => typeof message !== 'string' && texts(message).some((text) => placeholders(text).some((name) => !inputs(message).includes(name)))
		);
		expect(wrong.map(([key]) => key)).toEqual([]);
	});

	it('have no empty messages', () => {
		const empty = [...Object.entries(english), ...Object.entries(arabic)].filter(([, message]) => texts(message).some((text) => text.trim() === ''));
		expect(empty.map(([key]) => key)).toEqual([]);
	});
});
