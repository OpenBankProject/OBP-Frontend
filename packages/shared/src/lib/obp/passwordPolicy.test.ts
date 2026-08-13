import { describe, it, expect } from 'vitest';
import {
	evaluatePasswordPolicy,
	evaluatePasswordPolicies,
	isPasswordAcceptable,
	closestPolicyEvaluation,
	describeDisallowedCharacters,
	type OBPPasswordPolicies,
	type OBPPasswordPolicy
} from './passwordPolicy.js';

// Mirrors the two policies the OBP-API v7.0.0 endpoint publishes by default.
const printableAscii = Array.from({ length: 0x7e - 0x21 + 1 }, (_, i) =>
	String.fromCharCode(0x21 + i)
).join('');

const compositionPolicy: OBPPasswordPolicy = {
	description:
		'10 to 16 characters (printable ASCII, no space) including at least one digit, one lower case letter, one upper case letter and one special character.',
	min_length: 10,
	max_length: 16,
	required_character_classes: [
		{ name: 'digit', regex: '[0-9]' },
		{ name: 'lowercase letter', regex: '[a-z]' },
		{ name: 'uppercase letter', regex: '[A-Z]' },
		{ name: 'special character', regex: '[\\x21-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\x7e]' }
	],
	allowed_characters: printableAscii,
	regex: ''
};

const passphrasePolicy: OBPPasswordPolicy = {
	description: 'A passphrase of 17 to 512 characters (printable ASCII, no space), no composition rules.',
	min_length: 17,
	max_length: 512,
	required_character_classes: [],
	allowed_characters: printableAscii,
	regex: ''
};

const policies: OBPPasswordPolicies = {
	description: 'A password must satisfy at least one of the policies.',
	policies: [compositionPolicy, passphrasePolicy]
};

describe('evaluatePasswordPolicy', () => {
	it('accepts a compliant composition password', () => {
		const result = evaluatePasswordPolicy('Abcdef123!', compositionPolicy);
		expect(result.satisfied).toBe(true);
		expect(result.requirements.every((r) => r.met)).toBe(true);
		expect(result.disallowedCharacters).toEqual([]);
	});

	it('rejects a password missing a required character class', () => {
		const result = evaluatePasswordPolicy('Abcdefgh123', compositionPolicy);
		expect(result.satisfied).toBe(false);
		const special = result.requirements.find((r) => r.label === 'At least one special character');
		expect(special?.met).toBe(false);
	});

	it('rejects a password over the composition max length', () => {
		const result = evaluatePasswordPolicy('Abcdef123!Abcdef123!', compositionPolicy);
		expect(result.satisfied).toBe(false);
		expect(result.requirements[0].met).toBe(false);
	});

	it('reports disallowed characters distinctly', () => {
		const result = evaluatePasswordPolicy('Abc def 123!§§', compositionPolicy);
		expect(result.satisfied).toBe(false);
		expect(result.disallowedCharacters).toEqual([' ', '§']);
	});

	it('accepts a long passphrase without composition rules', () => {
		const result = evaluatePasswordPolicy('correcthorsebatterystaple', passphrasePolicy);
		expect(result.satisfied).toBe(true);
	});
});

describe('isPasswordAcceptable', () => {
	it('is satisfied by either policy', () => {
		expect(isPasswordAcceptable('Abcdef123!', policies)).toBe(true);
		expect(isPasswordAcceptable('correcthorsebatterystaple', policies)).toBe(true);
	});

	it('rejects passwords satisfying neither policy', () => {
		expect(isPasswordAcceptable('short', policies)).toBe(false);
		expect(isPasswordAcceptable('abcdefghijklm', policies)).toBe(false);
		expect(isPasswordAcceptable('correct horse battery staple', policies)).toBe(false);
	});

	it('defers to the server when the config is unavailable', () => {
		expect(isPasswordAcceptable('anything', null)).toBe(true);
		expect(isPasswordAcceptable('anything', undefined)).toBe(true);
	});
});

describe('closestPolicyEvaluation', () => {
	it('picks the composition policy for a short password', () => {
		const best = closestPolicyEvaluation(evaluatePasswordPolicies('abc', policies.policies));
		expect(best?.policy).toBe(compositionPolicy);
	});

	it('picks the passphrase policy for a long passphrase with a space', () => {
		const best = closestPolicyEvaluation(
			evaluatePasswordPolicies('correct horse battery staple', policies.policies)
		);
		expect(best?.policy).toBe(passphrasePolicy);
	});

	it('returns null for an empty evaluation list', () => {
		expect(closestPolicyEvaluation([])).toBeNull();
	});
});

describe('describeDisallowedCharacters', () => {
	it('names the space character', () => {
		expect(describeDisallowedCharacters([' ', '§'])).toBe('space, "§"');
	});
});
