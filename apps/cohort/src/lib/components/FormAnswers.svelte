<script lang="ts">
	import { answerText, questionLabel, type Answers, type Question } from '$lib/forms';
	import type { Locale } from '$lib/i18n';

	/** The answers to a form-builder form, read only: every question asked, and hidden ones that were answered. */
	let { locale, questions, answers }: { locale: Locale; questions: Question[]; answers: Answers } = $props();

	const shown = $derived(questions.filter((q) => !q.hidden || answers[q.key] !== undefined));
</script>

{#each shown as q (q.key)}
	<dt>{questionLabel(q, locale)}</dt>
	<dd class="whitespace-pre-line">{answerText(q, answers[q.key], locale) || '—'}</dd>
{/each}
