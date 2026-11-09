<script lang="ts">
	import { ArrowDown, ArrowUp, Plus, Trash2 } from '@lucide/svelte';
	import { t, type Locale } from '$lib/i18n';
	import { LAST_STAGE, stageName, stagesOf, type StageDef } from '$lib/stages';

	/**
	 * A programme's stages and gates, edited in place and posted as JSON in the stages field. Every startup starts
	 * onboarded; the stages here come after that, and the last, graduated, cannot be removed or moved.
	 */
	let { locale, values = {} }: { locale: Locale; values?: Record<string, unknown> } = $props();

	// Started once from the record being edited; the editor owns the list after that.
	// svelte-ignore state_referenced_locally
	let stages = $state<StageDef[]>(structuredClone(stagesOf(values)));
	const json = $derived(JSON.stringify(stages));

	type MilestoneRule = 'none' | 'all' | 'at_least';
	const ruleOf = (s: StageDef): MilestoneRule => (s.gate.milestones === 'none' ? 'none' : s.gate.milestones === 'all' ? 'all' : 'at_least');

	function add() {
		stages.splice(stages.length - 1, 0, { key: '', name: '', name_ar: '', gate: { company: false, milestones: 'none', sessions: 0 } });
	}
	function move(i: number, by: -1 | 1) {
		const [stage] = stages.splice(i, 1);
		stages.splice(i + by, 0, stage);
	}
	function setRule(s: StageDef, rule: MilestoneRule) {
		s.gate.milestones = rule === 'at_least' ? (typeof s.gate.milestones === 'number' ? s.gate.milestones : 1) : rule;
	}
</script>

<fieldset class="card preset-outlined-surface-200-800 flex flex-col gap-3 p-3" data-testid="programme-stages">
	<legend class="px-1 font-bold">{t(locale, 'stages_heading')}</legend>
	<p class="text-sm">{t(locale, 'stages_intro')}</p>
	<input type="hidden" name="stages" value={json} />
	<ol class="flex flex-col gap-3">
		<li class="text-sm">1. {stageName(locale, 'onboarded')}</li>
		{#each stages as s, i (i)}
			{@const last = s.key === LAST_STAGE}
			<li class="border-surface-200-800 flex flex-col gap-2 rounded border p-2" data-testid="stage-row-{i}">
				<div class="flex flex-wrap items-end gap-2">
					<span class="font-bold">{i + 2}.</span>
					{#if last}
						<span class="font-bold">{stageName(locale, LAST_STAGE)}</span>
					{:else}
						<label class="label w-48"><span class="label-text">{t(locale, 'stages_name')}</span><input class="input input-sm" bind:value={s.name} maxlength="100" placeholder={s.key ? stageName(locale, s.key) : ''} /></label>
						<label class="label w-48" dir="rtl"><span class="label-text">{t(locale, 'stages_name_ar')}</span><input class="input input-sm" bind:value={s.name_ar} maxlength="100" lang="ar" /></label>
						<span class="flex gap-1">
							<button type="button" class="btn-icon btn-icon-sm preset-tonal" disabled={i === 0} onclick={() => move(i, -1)} aria-label={t(locale, 'stages_up')}><ArrowUp class="size-4" aria-hidden="true" /></button>
							<button type="button" class="btn-icon btn-icon-sm preset-tonal" disabled={i >= stages.length - 2} onclick={() => move(i, 1)} aria-label={t(locale, 'stages_down')}><ArrowDown class="size-4" aria-hidden="true" /></button>
							<button type="button" class="btn-icon btn-icon-sm preset-tonal-error" onclick={() => stages.splice(i, 1)} aria-label={t(locale, 'stages_remove')}><Trash2 class="size-4" aria-hidden="true" /></button>
						</span>
					{/if}
				</div>
				<div class="flex flex-wrap items-center gap-4 text-sm">
					<span>{t(locale, 'stages_gate')}</span>
					<label class="flex items-center gap-2"><input class="checkbox" type="checkbox" bind:checked={s.gate.company} />{t(locale, 'stages_gate_company')}</label>
					<label class="flex items-center gap-2">{t(locale, 'stages_gate_milestones')}
						<select class="select select-sm w-auto" value={ruleOf(s)} onchange={(e) => setRule(s, e.currentTarget.value as MilestoneRule)}>
							<option value="none">{t(locale, 'stages_milestones_none')}</option>
							<option value="all">{t(locale, 'stages_milestones_all')}</option>
							<option value="at_least">{t(locale, 'stages_milestones_at_least')}</option>
						</select>
						{#if typeof s.gate.milestones === 'number'}<input class="input input-sm w-20" type="number" min="1" bind:value={s.gate.milestones} aria-label={t(locale, 'stages_milestones_at_least')} />{/if}
					</label>
					<label class="flex items-center gap-2">{t(locale, 'stages_gate_sessions')}<input class="input input-sm w-20" type="number" min="0" bind:value={s.gate.sessions} /></label>
				</div>
			</li>
		{/each}
	</ol>
	<button type="button" class="btn btn-sm preset-tonal self-start" onclick={add} data-testid="stage-add"><Plus class="size-4" aria-hidden="true" />{t(locale, 'stages_add')}</button>
</fieldset>
