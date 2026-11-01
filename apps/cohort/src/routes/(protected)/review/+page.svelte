<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { t, type Locale, type MessageKey } from '$lib/i18n';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
</script>

<h1 class="h2">{t(locale, 'review_heading')}</h1>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{t(locale, 'staff_error')} {String(form.error)}</p>{/if}

{#if !data.profile}
	<section class="card preset-outlined-surface-200-800 mt-6 max-w-xl p-4" data-testid="review-register">
		<h2 class="h4">{t(locale, 'review_become')}</h2>
		<p class="mt-1">{t(locale, 'review_become_intro')}</p>
		<form method="POST" action="?/register" class="mt-3 flex flex-col gap-2">
			<label class="label"><span class="label-text">{t(locale, 'review_display_name')} *</span><input class="input" name="display_name" required maxlength="255" value={data.username} /></label>
			<label class="label"><span class="label-text">{t(locale, 'review_expertise')}</span><input class="input" name="expertise" maxlength="1000" /></label>
			<button class="btn preset-filled-primary-500 self-start" data-testid="review-register-submit">{t(locale, 'review_become_submit')}</button>
		</form>
	</section>
{:else}
	<p class="mt-2">{t(locale, 'review_registered_as')} <strong>{data.profile.display_name}</strong>{#if data.profile.expertise} ({data.profile.expertise}){/if}.</p>
	{#if data.standing === 'pending'}
		<p class="mt-4 preset-tonal rounded p-3" role="status" data-testid="review-pending">{t(locale, 'review_pending')}</p>
	{:else if data.standing === 'declined'}
		<p class="mt-4 preset-tonal rounded p-3" role="status" data-testid="review-declined">{t(locale, 'review_declined')}</p>
	{/if}
{/if}

{#if data.profile && data.standing === 'accepted'}
<section class="card preset-outlined-surface-200-800 mt-6 p-4" data-testid="review-assignments">
	<h2 class="h4">{t(locale, 'review_assigned')}</h2>
	{#each Object.values(data.lacking).filter(Boolean) as role (role!.role_name)}
		<div class="mt-2"><MissingRole {locale} space={data.space} role={role!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>
	{/each}
	{#if data.assignments.length === 0}
		<p class="mt-2">{t(locale, 'review_none')}</p>
	{:else}
		<div class="table-wrap mt-2">
			<table class="table">
				<thead><tr><th>{t(locale, 'staff_applicant')}</th><th>{t(locale, 'application_call')}</th><th>{t(locale, 'eval_due')}</th><th>{t(locale, 'staff_field_status')}</th><th></th></tr></thead>
				<tbody>
					{#each data.assignments as a (a.id)}
						<tr>
							<td>{a.startup_name}</td>
							<td>{a.call}</td>
							<td>{a.due_on}</td>
							<td>{t(locale, `review_status_${a.status}` as MessageKey)}</td>
							<td><a class="btn btn-sm preset-tonal" href="/review/{a.id}" data-testid="review-open-{a.id}">{t(locale, a.status === 'to_do' ? 'review_start' : 'review_view')}</a></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
{/if}
