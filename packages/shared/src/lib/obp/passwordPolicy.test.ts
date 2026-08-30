import { describe, it, expect } from 'vitest';
import {
	evaluatePasswordPolicy,
	evaluatePasswordPolicies,
	isPasswordAcceptable,
	closestPolicyEvaluation,
	describeDisallowedCharacters,
	passphrasePolicy,
	passwordRulesAttribute,
	describePasswordPolicy,
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

const passphraseFixture: OBPPasswordPolicy = {
	description: 'A passphrase of 17 to 512 characters (printable ASCII, no space), no composition rules.',
	min_length: 17,
	max_length: 512,
	required_character_classes: [],
	allowed_characters: printableAscii,
	regex: ''
};

const policies: OBPPasswordPolicies = {
	description: 'A password must satisfy at least one of the policies.',
	policies: [compositionPolicy, passphraseFixture]
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
		const result = evaluatePasswordPolicy('correcthorsebatterystaple', passphraseFixture);
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
		expect(best?.policy).toBe(passphraseFixture);
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

describe('passphraseFixture', () => {
	it('picks the policy with no composition rules', () => {
		expect(passphrasePolicy(policies)).toBe(passphraseFixture);
	});

	it('returns null when every policy has composition rules, or there is no config', () => {
		expect(passphrasePolicy({ description: '', policies: [compositionPolicy] })).toBeNull();
		expect(passphrasePolicy(null)).toBeNull();
	});
});

describe('passwordRulesAttribute', () => {
	it('describes the passphrase policy when there is one, asking for every class so the result is strong by construction', () => {
		expect(passwordRulesAttribute(policies)).toBe(
			'minlength: 17; maxlength: 512; required: lower; required: upper; required: digit; required: [-!@#$%^&*_+=?.];'
		);
	});

	it('falls back to the composition policy, mapping classes to grammar tokens', () => {
		expect(passwordRulesAttribute({ description: '', policies: [compositionPolicy] })).toBe(
			'minlength: 10; maxlength: 16; required: digit; required: lower; required: upper; required: [-!@#$%^&*_+=?.];'
		);
	});

	it('only offers special characters the policy allows', () => {
		const strict: OBPPasswordPolicy = {
			...passphraseFixture,
			allowed_characters: 'abcXYZ019-_'
		};
		expect(passwordRulesAttribute({ description: '', policies: [strict] })).toBe(
			'minlength: 17; maxlength: 512; required: lower; required: upper; required: digit; required: [-_];'
		);
	});

	it('is empty without a config so the attribute can be omitted', () => {
		expect(passwordRulesAttribute(null)).toBe('');
		expect(passwordRulesAttribute({ description: '', policies: [] })).toBe('');
	});
});

describe('describePasswordPolicy', () => {
	it('words the passphrase policy as a floor with no other rules', () => {
		expect(describePasswordPolicy(passphraseFixture)).toBe('17 characters or more, no other rules');
	});

	it('lists the required classes of a composition policy', () => {
		expect(describePasswordPolicy(compositionPolicy)).toBe(
			'10 to 16 characters with at least one digit, lowercase letter, uppercase letter and special character'
		);
	});

	it('handles a single class and a small max', () => {
		expect(
			describePasswordPolicy({
				...compositionPolicy,
				min_length: 8,
				max_length: 64,
				required_character_classes: [{ name: 'digit', regex: '[0-9]' }]
			})
		).toBe('8 to 64 characters with at least one digit');
	});
});
