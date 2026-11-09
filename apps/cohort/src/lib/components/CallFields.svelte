<script lang="ts">
	import { eligibilityRulesOf, RESIDENCY_RULES, STAGES } from '$lib/applications';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	/** The cohort_call form fields, for creating and editing. `values` is the record being edited, if any. */
	let {
		locale,
		programmes,
		values = {}
	}: { locale: Locale; programmes: { id: string; name: string }[]; values?: Record<string, unknown> } = $props();
	const v = (key: string) => String(values[key] ?? '');
	const statuses = ['draft', 'open', 'closed'];
	const rules = $derived(eligibilityRulesOf(values));
</script>

<label class="label"><span class="label-text">{t(locale, 'staff_field_programme')} *</span>
	<select class="select" name="programme_id" required>{#each programmes as p (p.id)}<option value={p.id} selected={p.id === v('programme_id')}>{p.name}</option>{/each}</select></label>
<label class="label"><span class="label-text">{t(locale, 'staff_field_title')} *</span><input class="input" name="title" required maxlength="255" value={v('title')} /></label>
<label class="label"><span class="label-text">{t(locale, 'staff_field_description')}</span><textarea class="textarea" name="description" rows="3" maxlength="4000" value={v('description')}></textarea></label>
<label class="label"><span class="label-text">{t(locale, 'staff_field_status')}</span>
	<select class="select" name="status">{#each statuses as s (s)}<option value={s} selected={s === v('status')}>{t(locale, `status_${s}` as MessageKey)}</option>{/each}</select></label>
<label class="label"><span class="label-text">{t(locale, 'staff_field_opens_at')}</span><input class="input" type="date" name="opens_at" value={v('opens_at')} /></label>
<label class="label"><span class="label-text">{t(locale, 'staff_field_closes_at')}</span><input class="input" type="date" name="closes_at" value={v('closes_at')} /></label>
<fieldset class="card preset-outlined-surface-200-800 flex flex-col gap-3 p-3" data-testid="call-eligibility">
	<legend class="px-1 font-bold">{t(locale, 'eligibility_rules')}</legend>
	<p class="text-sm">{t(locale, 'eligibility_rules_intro')}</p>
	<label class="label"><span class="label-text">{t(locale, 'eligibility_residency')}</span>
		<select class="select" name="eligibility_residency">{#each RESIDENCY_RULES as r (r)}<option value={r} selected={r === rules.residency}>{t(locale, `eligibility_residency_${r}` as MessageKey)}</option>{/each}</select></label>
	<label class="label"><span class="label-text">{t(locale, 'eligibility_min_team_size')}</span><input class="input" type="number" min="1" name="eligibility_min_team_size" value={rules.min_team_size ?? ''} /></label>
	<div>
		<p class="label-text">{t(locale, 'eligibility_stages')}</p>
		<div class="flex flex-wrap gap-4">
			{#each STAGES as s (s)}
				<label class="flex items-center gap-2"><input class="checkbox" type="checkbox" name="eligibility_stages" value={s} checked={rules.stages.includes(s)} />{t(locale, `stage_${s}` as MessageKey)}</label>
			{/each}
		</div>
	</div>
</fieldset>
