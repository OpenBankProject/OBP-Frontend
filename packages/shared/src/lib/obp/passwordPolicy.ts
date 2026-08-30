// Client-side evaluation of the password policy published by
// GET /obp/v7.0.0/public/password-config.
//
// The endpoint returns a list of alternative policies; a password is valid if it
// satisfies AT LEAST ONE of them. The structured fields (lengths, character
// classes, allowed characters) are the normative contract and are what we
// evaluate here — the `regex` field is a server-provided convenience we ignore.
// The server remains the final enforcer (OBP-30207 on violation), so when the
// config cannot be fetched, callers should skip local validation rather than
// block the user.

export interface OBPRequiredCharacterClass {
	name: string;
	regex: string;
}

export interface OBPPasswordPolicy {
	description: string;
	min_length: number;
	max_length: number;
	required_character_classes: OBPRequiredCharacterClass[];
	allowed_characters: string;
	regex: string;
}

export interface OBPPasswordPolicies {
	description: string;
	policies: OBPPasswordPolicy[];
}

export interface PasswordRequirementResult {
	label: string;
	met: boolean;
}

export interface PasswordPolicyEvaluation {
	policy: OBPPasswordPolicy;
	satisfied: boolean;
	requirements: PasswordRequirementResult[];
	/** Distinct characters of the password that the policy does not allow. */
	disallowedCharacters: string[];
}

export function evaluatePasswordPolicy(
	password: string,
	policy: OBPPasswordPolicy
): PasswordPolicyEvaluation {
	const requirements: PasswordRequirementResult[] = [
		{
			label: `${policy.min_length} to ${policy.max_length} characters`,
			met: password.length >= policy.min_length && password.length <= policy.max_length
		}
	];

	for (const characterClass of policy.required_character_classes) {
		requirements.push({
			label: `At least one ${characterClass.name}`,
			met: new RegExp(characterClass.regex).test(password)
		});
	}

	const disallowedCharacters = [...new Set(password)].filter(
		(character) => !policy.allowed_characters.includes(character)
	);

	return {
		policy,
		satisfied: requirements.every((requirement) => requirement.met) && disallowedCharacters.length === 0,
		requirements,
		disallowedCharacters
	};
}

export function evaluatePasswordPolicies(
	password: string,
	policies: OBPPasswordPolicy[]
): PasswordPolicyEvaluation[] {
	return policies.map((policy) => evaluatePasswordPolicy(password, policy));
}

/**
 * Whether the password satisfies at least one policy. A null/absent config
 * means the policy is unknown on the client — return true and let the server
 * enforce, so a config outage never blocks registration or password reset.
 */
export function isPasswordAcceptable(
	password: string,
	policies: OBPPasswordPolicies | null | undefined
): boolean {
	if (!policies) {
		return true;
	}
	return policies.policies.some((policy) => evaluatePasswordPolicy(password, policy).satisfied);
}

/**
 * The evaluation worth showing as feedback: the policy the password comes
 * closest to satisfying, measured by the fraction of requirements met (a
 * disallowed-characters violation counts as one extra unmet requirement).
 * Ties go to the earlier policy.
 */
export function closestPolicyEvaluation(
	evaluations: PasswordPolicyEvaluation[]
): PasswordPolicyEvaluation | null {
	let best: PasswordPolicyEvaluation | null = null;
	let bestScore = -1;
	for (const evaluation of evaluations) {
		const total = evaluation.requirements.length + (evaluation.disallowedCharacters.length > 0 ? 1 : 0);
		const met = evaluation.requirements.filter((requirement) => requirement.met).length;
		const score = total === 0 ? 1 : met / total;
		if (score > bestScore) {
			best = evaluation;
			bestScore = score;
		}
	}
	return best;
}

/** Human-readable listing of disallowed characters, e.g. `space, "§"`. */
export function describeDisallowedCharacters(characters: string[]): string {
	return characters.map((character) => (character === ' ' ? 'space' : `"${character}"`)).join(', ');
}

/**
 * The policy with no composition rules (OBP's "passphrase" branch), if any —
 * the one we steer people towards, because any sufficiently long string
 * passes it, including what browser password generators produce.
 */
export function passphrasePolicy(
	policies: OBPPasswordPolicies | null | undefined
): OBPPasswordPolicy | null {
	const candidates = (policies?.policies ?? []).filter(
		(policy) => policy.required_character_classes.length === 0
	);
	if (candidates.length === 0) return null;
	return candidates.reduce((best, policy) => (policy.max_length > best.max_length ? policy : best));
}

/**
 * Special characters we let generators use. A deliberate subset of what OBP
 * allows: every one is unambiguous in the `passwordrules` grammar (no `]`,
 * `\`, quotes or separators) and easy to type on any keyboard.
 */
const GENERATOR_SPECIALS = '-!@#$%^&*_+=?.';

function classToken(characterClass: OBPRequiredCharacterClass, allowed: string): string {
	switch (characterClass.regex) {
		case '[0-9]':
			return 'digit';
		case '[a-z]':
			return 'lower';
		case '[A-Z]':
			return 'upper';
		default: {
			const re = new RegExp(characterClass.regex);
			const chars = [...GENERATOR_SPECIALS].filter((c) => allowed.includes(c) && re.test(c));
			return chars.length > 0 ? `[${chars.join('')}]` : 'special';
		}
	}
}

/**
 * Value for the `passwordrules` attribute (Apple's Password Rules grammar,
 * honoured by Safari's and Chrome's generators) describing ONE policy — the
 * grammar can't express "either/or". The passphrase policy wins when present:
 * its length floor is the one rule every generator obeys, whereas some (Google
 * Password Manager) skip special characters unless told, and would otherwise
 * produce a 15-character password that satisfies neither OBP branch.
 *
 * Every character class is stated as `required:` rather than `allowed:`, even
 * for the passphrase policy that doesn't demand them: a generated password is
 * then strong by construction (mixed case, digit, symbol) and would pass the
 * composition branch too. `required:` is a request to the generator only —
 * what a human types is still judged by the real policy.
 * Returns '' when the policy is unknown, so the attribute is omitted.
 */
export function passwordRulesAttribute(policies: OBPPasswordPolicies | null | undefined): string {
	const passphrase = passphrasePolicy(policies);
	const policy = passphrase ?? policies?.policies?.[0];
	if (!policy) return '';

	const allowed = policy.allowed_characters;
	const rules = [`minlength: ${policy.min_length}`, `maxlength: ${policy.max_length}`];

	if (policy.required_character_classes.length === 0) {
		const specials = [...GENERATOR_SPECIALS].filter((c) => allowed.includes(c)).join('');
		rules.push('required: lower', 'required: upper', 'required: digit');
		if (specials) rules.push(`required: [${specials}]`);
	} else {
		for (const characterClass of policy.required_character_classes) {
			rules.push(`required: ${classToken(characterClass, allowed)}`);
		}
	}
	return rules.join('; ') + ';';
}

/**
 * Our own one-line wording for a policy, built from its structured fields.
 * The server's `description` is verbose and written for API consumers
 * ("printable ASCII, no space", "no composition rules"); this is what we show
 * people. Examples:
 *   "17 characters or more, no other rules"
 *   "10 to 16 characters with at least one digit, lowercase letter, uppercase letter and special character"
 */
export function describePasswordPolicy(policy: OBPPasswordPolicy): string {
	// A max in the hundreds is a ceiling nobody will hit; don't make people read it.
	const length =
		policy.max_length >= 100
			? `${policy.min_length} characters or more`
			: `${policy.min_length} to ${policy.max_length} characters`;
	const names = policy.required_character_classes.map((c) => c.name);
	if (names.length === 0) return `${length}, no other rules`;
	const list =
		names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
	return `${length} with at least one ${list}`;
}
