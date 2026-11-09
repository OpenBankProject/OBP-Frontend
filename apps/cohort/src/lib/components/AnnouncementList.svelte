<script lang="ts">
	import { Megaphone } from '@lucide/svelte';
	import { inReaderLocale, type Announcement } from '$lib/announcements';
	import { t, type Locale } from '$lib/i18n';

	/** Announcements from the programme office, newest first, in the reader's language. */
	let { locale, announcements, testid = 'announcements' }: { locale: Locale; announcements: Announcement[]; testid?: string } = $props();
</script>

{#if announcements.length > 0}
	<section class="card preset-tonal-secondary p-4" data-testid={testid}>
		<h2 class="h5 flex items-center gap-2"><Megaphone class="size-5" aria-hidden="true" />{t(locale, 'announcements_heading')}</h2>
		<ul class="mt-2 flex flex-col gap-3">
			{#each announcements as a (a.id)}
				{@const text = inReaderLocale(a, locale)}
				<li>
					<p dir="auto"><strong>{text.title}</strong> <span class="text-sm">{a.published_at.slice(0, 10)}</span></p>
					{#if text.body}<p class="whitespace-pre-line" dir="auto">{text.body}</p>{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
