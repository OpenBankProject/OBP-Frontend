<script lang="ts">
	import MissingRole from '$lib/components/MissingRole.svelte';
	import { inLocale } from '$lib/forms';
	import { t, type Locale, type MessageKey } from '$lib/i18n';
	import { CREATABLE_KINDS } from '$lib/corporateCustomers';

	let { data, form } = $props();

	const locale = $derived(data.locale as Locale);
	const missing = (key: keyof typeof data.lacking) => data.lacking[key];
	const creatable = CREATABLE_KINDS;
	const errorText = (e: string) => (['customer_missing', 'member_missing', 'member_not_found', 'member_ambiguous'].includes(e) ? t(locale, e as MessageKey) : `${t(locale, 'staff_error')} ${e}`);
</script>

<h1 class="h2">{t(locale, 'customers_heading')}</h1>
<p class="mt-2">{t(locale, 'customers_intro')}</p>

{#if form?.form === 'role' && form?.requested}<p class="mt-4 ui-tone-success rounded p-3" role="status">{t(locale, 'access_requested_notice')}</p>{/if}
{#if form?.error}<p class="mt-4 ui-tone-error rounded p-3" role="alert">{errorText(String(form.error))}</p>{/if}
{#if form?.form === 'create' && form?.created}<p class="mt-4 ui-tone-success rounded p-3" role="status">{t(locale, 'customer_created')}</p>{/if}
{#if form?.form === 'member' && (form?.added || form?.removed)}<p class="mt-4 ui-tone-success rounded p-3" role="status">{t(locale, 'customer_members_saved')}</p>{/if}

<section class="card border ui-border mt-6 p-4" data-testid="customer-new">
	<h2 class="h4">{t(locale, 'customer_new')}</h2>
	{#if missing('customer') || missing('attribute')}
		{#each ['customer', 'attribute'] as const as key (key)}
			{#if missing(key)}<div class="mt-2"><MissingRole {locale} space={data.space} role={missing(key)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>{/if}
		{/each}
	{:else}
		<form method="POST" action="?/create" class="mt-2 grid gap-3 md:grid-cols-2">
			<label class="label"><span class="label-text">{t(locale, 'customer_name')} *</span><input class="input" name="name" required maxlength="255" /></label>
			<label class="label" dir="rtl"><span class="label-text">{t(locale, 'customer_name_ar')}</span><input class="input" name="name_ar" maxlength="255" lang="ar" /></label>
			<label class="label"><span class="label-text">{t(locale, 'customer_kind')}</span>
				<select class="select" name="kind">{#each creatable as k (k)}<option value={k}>{t(locale, `customer_kind_${k}` as MessageKey)}</option>{/each}</select></label>
			<label class="label"><span class="label-text">{t(locale, 'customer_website')}</span><input class="input" type="url" name="website" maxlength="500" /></label>
			<label class="label"><span class="label-text">{t(locale, 'details_email')} *</span><input class="input" type="email" name="email" required /></label>
			<label class="label"><span class="label-text">{t(locale, 'details_mobile')} *</span><input class="input" type="tel" name="mobile_phone_number" required /></label>
			<button class="btn preset-filled-primary-500 self-start" data-testid="customer-create">{t(locale, 'customer_create')}</button>
		</form>
	{/if}
</section>

<section class="card border ui-border mt-6 p-4" data-testid="customers">
	{#each ['read', 'members', 'link', 'unlink', 'users'] as const as key (key)}
		{#if missing(key)}<div class="mb-2"><MissingRole {locale} space={data.space} role={missing(key)!} entitlementRequestsUrl={data.entitlementRequestsUrl} /></div>{/if}
	{/each}
	{#if data.customers.length === 0}
		<p>{t(locale, 'customers_none')}</p>
	{:else}
		<ul class="flex flex-col gap-4">
			{#each data.customers as o (o.id)}
				<li class="ui-border border-b pb-4" data-testid="customer-{o.id}">
					<p class="flex flex-wrap items-center gap-2">
						<span class="badge preset-tonal">{t(locale, `customer_kind_${o.kind}` as MessageKey)}</span>
						<strong>{inLocale(locale, o.name, o.name_ar)}</strong>
						{#if o.website}<a class="anchor text-sm" href={o.website} rel="noopener noreferrer">{o.website}</a>{/if}
					</p>
					{#if o.members === null}
						<p class="mt-1 text-sm">{t(locale, 'customer_members_unknown')}</p>
					{:else}
						<p class="mt-1 text-sm">{t(locale, 'customer_members')}: {o.members.length === 0 ? t(locale, 'customer_members_none') : ''}</p>
						<ul class="ms-4 mt-1 flex flex-col gap-1">
							{#each o.members as m (m.link_id)}
								<li class="flex flex-wrap items-center gap-2">
									<span>{m.username || m.user_id}</span>
									{#if !missing('unlink')}
										<form method="POST" action="?/removeMember">
											<input type="hidden" name="link_id" value={m.link_id} />
											<button class="btn btn-sm preset-filled-error-500" data-testid="member-remove-{m.link_id}">{t(locale, 'customer_member_remove')}</button>
										</form>
									{/if}
								</li>
							{/each}
						</ul>
						{#if !missing('link') && !missing('users')}
							<form method="POST" action="?/addMember" class="mt-2 flex flex-wrap items-end gap-2">
								<input type="hidden" name="customer_id" value={o.customer_id} />
								<label class="label w-56"><span class="label-text">{t(locale, 'customer_member_username')}</span><input class="input input-sm" name="username" required /></label>
								<button class="btn btn-sm preset-tonal" data-testid="member-add-{o.id}">{t(locale, 'customer_member_add')}</button>
							</form>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
