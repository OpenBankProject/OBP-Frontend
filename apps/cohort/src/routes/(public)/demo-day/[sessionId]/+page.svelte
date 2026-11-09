<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
</script>

{#if data.programme}<p class="badge preset-tonal-tertiary">{data.programme}</p>{/if}
<h1 class="h2 mt-2">{data.session.title}</h1>
<p class="mt-2">{data.session.starts_at.replace('T', ' ')} · {data.session.duration_minutes} {t(locale, 'sessions_minutes')}{#if data.session.location} · {data.session.location}{/if}</p>

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="demo-agenda">
	<h2 class="h4">{t(locale, 'demo_agenda')}</h2>
	{#if data.slots.length === 0}
		<p class="mt-2">{t(locale, 'demo_agenda_soon')}</p>
	{:else}
		<ol class="mt-2 flex flex-col gap-2">
			{#each data.slots as slot (slot.id)}
				<li class="flex flex-wrap items-baseline gap-2">
					<span class="badge preset-tonal">{slot.position}</span>
					{#if slot.starts_at}<span class="font-mono">{slot.starts_at}</span>{/if}
					<strong>{slot.startup_name}</strong>{#if slot.pitch_title}<span>· {slot.pitch_title}</span>{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>
