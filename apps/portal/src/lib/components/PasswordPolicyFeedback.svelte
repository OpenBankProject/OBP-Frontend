<script lang="ts">
	import {
		evaluatePasswordPolicies,
		closestPolicyEvaluation,
		describeDisallowedCharacters,
		type OBPPasswordPolicies
	} from '@obp/shared/obp';

	let { password, policies } = $props<{
		password: string;
		policies: OBPPasswordPolicies | null;
	}>();

	let evaluations = $derived(
		policies ? evaluatePasswordPolicies(password, policies.policies) : []
	);
	let satisfied = $derived(evaluations.some((evaluation) => evaluation.satisfied));
	let closest = $derived(closestPolicyEvaluation(evaluations));
	let alternatives = $derived(evaluations.filter((evaluation) => evaluation !== closest));
</script>

{#if password.length > 0 && closest && !satisfied}
	<div class="text-error-500 mt-2 space-y-1 text-xs" data-testid="password-policy-feedback">
		<p class="font-semibold">{closest.policy.description}</p>
		<ul class="list-inside list-disc">
			{#each closest.requirements as requirement}
				<li class={requirement.met ? 'text-success-500' : ''}>{requirement.label}</li>
			{/each}
			{#if closest.disallowedCharacters.length > 0}
				<li>Not allowed: {describeDisallowedCharacters(closest.disallowedCharacters)}</li>
			{/if}
		</ul>
		{#each alternatives as alternative}
			<p class="mt-1 text-xs opacity-75">Alternatively: {alternative.policy.description}</p>
		{/each}
	</div>
{/if}
