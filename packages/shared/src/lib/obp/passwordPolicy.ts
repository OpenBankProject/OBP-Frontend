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
