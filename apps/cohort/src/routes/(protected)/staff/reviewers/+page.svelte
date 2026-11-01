<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const missing = (key: keyof typeof data.lacking) => data.lacking[key];
</script>

{#snippet roleNeeded(key: keyof typeof data.lacking)}
	{#if missing(key)}
		<div class="mt-2"><MissingRole {locale} space={data.space} role={missing(key)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
	{/if}
{/snippet}

<h1 class="h2">{t(locale, 'reviewers_heading')}</h1>
<p class="mt-1">{t(locale, 'reviewers_intro')}</p>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {String(form.error)}</p>{/if}
{#if form?.form === 'decide' && form?.decided}<p class="mt-4" role="status">{t(locale, `reviewers_done_${form.decided}` as MessageKey)}</p>{/if}

<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="reviewers-pool">
	{@render roleNeeded('pool')}
	{@render roleNeeded('decisions')}
	{@render roleNeeded('decide')}
	{#if data.errors.pool}
		<p class="mt-2">{data.errors.pool}</p>
	{:else if data.reviewers.length === 0}
		<p class="mt-2">{t(locale, 'reviewers_none')}</p>
	{:else}
		<div class="table-wrap mt-2">
			<table class="table">
				<thead><tr><th>{t(locale, 'review_display_name')}</th><th>{t(locale, 'review_expertise')}</th><th>{t(locale, 'staff_field_status')}</th><th></th></tr></thead>
				<tbody>
					{#each data.reviewers as r (r.user_id)}
						<tr data-testid="reviewer-{r.user_id}">
							<td>{r.display_name}</td>
							<td>{r.expertise}</td>
							<td>{r.standing ? t(locale, `reviewers_standing_${r.standing}` as MessageKey) : ''}</td>
							<td>
								{#if !missing('decide')}
									<form method="POST" action="?/decide" class="flex flex-wrap items-center gap-2">
										<input type="hidden" name="reviewer_user_id" value={r.user_id} />
										<input class="input w-48" name="reason" maxlength="4000" aria-label={t(locale, 'reviewers_reason')} placeholder={t(locale, 'reviewers_reason')} />
										{#if r.standing !== 'accepted'}<button class="btn btn-sm preset-filled-primary-500" name="decision" value="accepted" data-testid="reviewer-accept-{r.user_id}">{t(locale, 'reviewers_accept')}</button>{/if}
										{#if r.standing !== 'declined'}<button class="btn btn-sm preset-tonal" name="decision" value="declined" data-testid="reviewer-decline-{r.user_id}">{t(locale, 'reviewers_decline')}</button>{/if}
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
