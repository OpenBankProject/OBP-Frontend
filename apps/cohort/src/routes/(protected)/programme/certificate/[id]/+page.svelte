<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	let { data } = $props();

	const locale = $derived(data.locale as Locale);
	const c = $derived(data.certificate);
	const issuer = $derived(data.branding.name || t(locale, 'app_name'));
</script>

<!-- A certificate made to print: in the User's language (English or Arabic, laid out by the browser), so "Save as
     PDF" gives a correct PDF in either. Only the certificate prints; the page around it does not. -->
<div class="certificate-actions mb-4 flex gap-2 print:hidden">
	<a class="anchor" href="/programme">{t(locale, 'programme_heading')}</a>
	<button type="button" class="btn btn-sm preset-filled-primary-500" onclick={() => window.print()} data-testid="certificate-print">{t(locale, 'certificate_print')}</button>
</div>

<article class="certificate mx-auto max-w-3xl border-4 border-double border-surface-400-600 bg-white p-12 text-center text-surface-950" data-testid="certificate">
	<img src={data.branding.logoUrl} alt={issuer} class="mx-auto h-16" />
	<p class="mt-8 text-sm uppercase tracking-widest">{t(locale, 'certificate_title')}</p>
	<p class="mt-8">{t(locale, 'certificate_certifies')}</p>
	<p class="mt-4 text-4xl font-bold" data-testid="certificate-startup">{c.startup_name}</p>
	<p class="mt-6">{t(locale, 'certificate_completed')}</p>
	<p class="mt-2 text-2xl font-semibold">{c.programme_name}</p>
	<p class="mt-8">{t(locale, 'certificate_on')} {c.graduated_on}</p>
	<p class="mt-12 text-sm">{issuer}</p>
	<p class="mt-2 text-xs">{t(locale, 'certificate_reference')} {c.reference}</p>
</article>

<style>
	@media print {
		:global(aside),
		:global(header) {
			display: none !important;
		}
		.certificate {
			border-width: 6px;
			margin: 0 auto;
		}
	}
</style>
