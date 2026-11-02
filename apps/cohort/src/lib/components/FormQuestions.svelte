<script lang="ts">
	import { askedQuestions, fieldName, inLocale, questionHelp, questionLabel, type Answers, type Question } from '$lib/forms';
	import type { Locale } from '$lib/i18n';

	/** The inputs of a form-builder form, in the User's language: one renderer for application forms and surveys. */
	let { locale, questions, answers = {} }: { locale: Locale; questions: Question[]; answers?: Answers } = $props();

	const value = (q: Question) => String(answers[q.key] ?? '');
</script>

{#each askedQuestions(questions) as q (q.key)}
	{#if q.kind === 'checkbox'}
		<div>
			<label class="flex items-center gap-2">
				<input type="checkbox" class="checkbox" name={fieldName(q)} checked={answers[q.key] === true} />
				{questionLabel(q, locale)}{q.required ? ' *' : ''}
			</label>
			{#if questionHelp(q, locale)}<p class="text-sm">{questionHelp(q, locale)}</p>{/if}
		</div>
	{:else}
		<label class="label">
			<span class="label-text">{questionLabel(q, locale)}{q.required ? ' *' : ''}</span>
			{#if questionHelp(q, locale)}<span class="block text-sm">{questionHelp(q, locale)}</span>{/if}
			{#if q.kind === 'textarea'}
				<textarea class="textarea" name={fieldName(q)} rows="4" maxlength="4000">{value(q)}</textarea>
			{:else if q.kind === 'select'}
				<select class="select" name={fieldName(q)} value={value(q)}>
					<option value=""></option>
					{#each q.options ?? [] as option (option.en)}
						<option value={option.en}>{inLocale(locale, option.en, option.ar)}</option>
					{/each}
				</select>
			{:else if q.kind === 'number'}
				<input class="input" type="number" step="1" name={fieldName(q)} value={value(q)} />
			{:else if q.kind === 'date'}
				<input class="input w-auto" type="date" name={fieldName(q)} value={value(q)} />
			{:else}
				<input class="input" type="text" name={fieldName(q)} value={value(q)} maxlength="255" />
			{/if}
		</label>
	{/if}
{/each}
