<script lang="ts">
	import type { EligibilityRules } from '$lib/applications';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	/** A call's eligibility rules in words, for applicants. */
	let { locale, rules }: { locale: Locale; rules: EligibilityRules } = $props();
</script>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="call-eligibility-summary">
	<h2 class="h5">{t(locale, 'eligibility_who')}</h2>
	<ul class="mt-2 list-inside list-disc">
		<li>{t(locale, `eligibility_says_${rules.residency}` as MessageKey)}</li>
		{#if rules.min_team_size !== null}<li>{t(locale, 'eligibility_says_team')} {rules.min_team_size}</li>{/if}
		{#if rules.stages.length}<li>{t(locale, 'eligibility_says_stages')} {rules.stages.map((s) => t(locale, `stage_${s}` as MessageKey)).join(', ')}</li>{/if}
	</ul>
	<p class="mt-2 text-sm">{t(locale, 'eligibility_says_review')}</p>
</section>
