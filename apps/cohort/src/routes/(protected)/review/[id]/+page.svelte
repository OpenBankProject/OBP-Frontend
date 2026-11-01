<script lang="ts">
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const application = $derived((data.application ?? {}) as Record<string, unknown>);
	const value = (key: string) => String(application[key] ?? '');
</script>

<p><a class="anchor" href="/review">{t(locale, 'review_heading')}</a></p>
<h1 class="h2">{t(locale, 'review_one_heading')}</h1>
<p class="mt-1">{t(locale, 'application_call')}: {data.callTitle}{#if data.assignment.due_on} · {t(locale, 'eval_due')} {data.assignment.due_on}{/if}</p>

{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, `review_error_${form.error}` as MessageKey)}</p>{/if}

{#if data.step === 'declare'}
	<section class="card preset-outlined-surface-200-800 mt-6 max-w-2xl p-4" data-testid="review-declare">
		<h2 class="h4">{t(locale, 'review_coi_heading')}</h2>
		<p class="mt-1">{t(locale, 'review_coi_intro')}</p>
		<form method="POST" action="?/noConflict" class="mt-3">
			<button class="btn preset-filled-primary-500" data-testid="review-no-conflict">{t(locale, 'review_coi_none')}</button>
		</form>
		<form method="POST" action="?/conflict" class="mt-4 flex flex-col gap-2">
			<label class="label"><span class="label-text">{t(locale, 'review_coi_note')}</span><textarea class="textarea" name="conflict_note" rows="2" maxlength="1000" required></textarea></label>
			<button class="btn preset-tonal self-start" data-testid="review-conflict">{t(locale, 'review_coi_declare')}</button>
		</form>
	</section>
{:else if data.step === 'score'}
	<section class="mt-6" data-testid="review-application">
		<h2 class="h4">{value('startup_name')}</h2>
		<dl class="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
			{#each data.fields as field (field.key)}
				<dt>{t(locale, `field_${field.key}` as MessageKey)}</dt>
				<dd class="whitespace-pre-line">{#if field.kind === 'checkbox'}{application[field.key] ? '✓' : '—'}{:else}{value(field.key)}{/if}</dd>
			{/each}
		</dl>
	</section>
	<section class="card preset-outlined-surface-200-800 mt-6 max-w-2xl p-4" data-testid="review-score">
		<h2 class="h4">{t(locale, 'review_score_heading')}</h2>
		{#if data.rubric.length === 0}
			<p class="mt-2">{t(locale, 'review_no_rubric')}</p>
		{:else}
			<form method="POST" action="?/submit" class="mt-3 flex flex-col gap-3">
				{#each data.rubric as c (c.id)}
					<label class="label">
						<span class="label-text"><strong>{c.name}</strong> (0–{c.max_score}){#if c.weight > 1} · ×{c.weight}{/if}</span>
						{#if c.description}<span class="text-sm">{c.description}</span>{/if}
						<select class="select w-auto" name="score_{c.id}" required>
							<option value="" selected disabled>–</option>
							{#each Array.from({ length: c.max_score + 1 }, (_, i) => i) as n (n)}<option value={n}>{n}</option>{/each}
						</select>
					</label>
				{/each}
				<label class="label"><span class="label-text">{t(locale, 'review_comments')}</span><textarea class="textarea" name="comments" rows="4" maxlength="4000"></textarea></label>
				<button class="btn preset-filled-primary-500 self-start" data-testid="review-submit">{t(locale, 'review_submit')}</button>
			</form>
		{/if}
	</section>
{:else if data.existing}
	<section class="card preset-outlined-surface-200-800 mt-6 max-w-2xl p-4" data-testid="review-done">
		{#if data.existing.conflict_of_interest}
			<p>{t(locale, 'review_done_conflict')}</p>
			<p class="mt-2 text-sm whitespace-pre-line">{data.existing.conflict_note}</p>
		{:else}
			<p>{t(locale, 'review_done_scored')} <strong>{data.existing.total_score}</strong> / 100.</p>
			<ul class="mt-2 text-sm">
				{#each data.rubric as c (c.id)}<li>{c.name}: {data.existing.scores[c.id] ?? '–'} / {c.max_score}</li>{/each}
			</ul>
			{#if data.existing.comments}<p class="mt-2 whitespace-pre-line">{data.existing.comments}</p>{/if}
		{/if}
	</section>
{/if}
