<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import {
		evaluatePasswordPolicies,
		closestPolicyEvaluation,
		describeDisallowedCharacters,
		describePasswordPolicy,
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
	<div id="password-policy-feedback" class="text-error-500 mt-2 space-y-1 text-xs" data-testid="password-policy-feedback">
		<p class="font-semibold">{describePasswordPolicy(closest.policy)}</p>
		<ul class="list-inside list-disc">
			{#each closest.requirements as requirement}
				<li class={requirement.met ? 'text-success-500' : ''}>{requirement.label}</li>
			{/each}
			{#if closest.disallowedCharacters.length > 0}
				<li>Not allowed: {describeDisallowedCharacters(closest.disallowedCharacters)}</li>
			{/if}
		</ul>
		{#each alternatives as alternative}
			<p class="mt-1 text-xs opacity-75">Or: {describePasswordPolicy(alternative.policy)}</p>
		{/each}
	</div>
{/if}
