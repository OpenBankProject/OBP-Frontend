<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { ExternalLink, Info } from '@lucide/svelte';
	import type { OBPApiProductSubscription, OBPApiProductSubscriptionStatus } from '$lib/obp/types';
	import { stripeCheckoutUrl, stripeManageBillingUrl } from '$lib/subscriptions/billingLinks';

	let { data, form } = $props();

	// ---- Selection state for the apply form ----
	function productKey(bankId: string, code: string): string {
		return `${bankId}\u0000${code}`;
	}

	function initialProductKey(): string {
		const { api_product_code, bank_id } = data.preselect;
		if (!api_product_code) return '';
		const match = data.products.find(
			(p) => p.api_product_code === api_product_code && (!bank_id || p.bank_id === bank_id)
		);
		return match ? productKey(match.bank_id, match.api_product_code) : '';
	}

	function initialConsumerId(): string {
		if (data.preselect.consumer_id && data.consumers.some((c) => c.consumer_id === data.preselect.consumer_id)) {
			return data.preselect.consumer_id;
		}
		return data.consumers.length === 1 ? data.consumers[0].consumer_id : '';
	}

	let selectedProductKey = $state(initialProductKey());
	let selectedConsumerId = $state(initialConsumerId());
	let startDate = $state('');
	let endDate = $state('');
	let submitting = $state(false);
	let cancellingId = $state('');

	const selectedProduct = $derived(
		data.products.find((p) => productKey(p.bank_id, p.api_product_code) === selectedProductKey) ?? null
	);

	const banks = $derived([...new Set(data.products.map((p) => p.bank_id))].sort());

	const existingSubscription = $derived(
		selectedProduct && selectedConsumerId
			? data.subscriptions.find(
					(s) =>
						s.bank_id === selectedProduct.bank_id &&
						s.api_product_code === selectedProduct.api_product_code &&
						s.consumer_id === selectedConsumerId &&
						s.status !== 'cancelled'
				) ?? null
			: null
	);

	const canSubmit = $derived(
		!!selectedProduct && !!selectedConsumerId && selectedProduct.action !== 'contact' && !existingSubscription && !submitting
	);

	const submitLabel = $derived.by(() => {
		if (!selectedProduct) return 'Subscribe';
		if (selectedProduct.action === 'contact') return 'Contact the bank';
		if (selectedProduct.action === 'request') return 'Request subscription';
		return 'Subscribe';
	});

	// ---- Presentation helpers ----
	function formatPrice(price: number | undefined, currency?: string): string {
		if (price === undefined || price === null) return 'Price on request';
		if (price === 0) return 'Free';
		try {
			return new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: currency || 'USD',
				minimumFractionDigits: 0,
				maximumFractionDigits: 2
			}).format(price) + ' / month';
		} catch {
			return `${price} ${currency || ''} / month`;
		}
	}

	function formatDate(value: string | null | undefined): string {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function consumerName(consumerId: string): string {
		const consumer = data.consumers.find((c) => c.consumer_id === consumerId);
		return consumer?.app_name || consumerId;
	}

	function productName(subscription: OBPApiProductSubscription): string {
		const product = data.products.find(
			(p) => p.bank_id === subscription.bank_id && p.api_product_code === subscription.api_product_code
		);
		return product?.name || subscription.api_product_code;
	}

	function billingSystemOf(subscription: OBPApiProductSubscription): string {
		const product = data.products.find(
			(p) => p.bank_id === subscription.bank_id && p.api_product_code === subscription.api_product_code
		);
		return product?.billing_system ?? 'none';
	}

	/** "Pay" for a requested Stripe subscription, "Manage billing" for a live one, otherwise nothing. */
	function billingLink(subscription: OBPApiProductSubscription): { label: string; href: string } | null {
		if (billingSystemOf(subscription) !== 'stripe') return null;
		if (subscription.status === 'requested') {
			const href = stripeCheckoutUrl(data.billingServiceUrl, subscription.api_product_subscription_id);
			return href ? { label: 'Pay', href } : null;
		}
		if (subscription.status === 'active' || subscription.status === 'past_due') {
			const href = stripeManageBillingUrl(data.billingServiceUrl);
			return href ? { label: 'Manage billing', href } : null;
		}
		return null;
	}

	const statusStyles: Record<OBPApiProductSubscriptionStatus, string> = {
		requested: 'ui-tone-info',
		active: 'ui-tone-success',
		past_due: 'ui-tone-warning',
		suspended: 'ui-tone-warning',
		cancelled: 'ui-panel ui-muted'
	};

	const statusLabels: Record<OBPApiProductSubscriptionStatus, string> = {
		requested: 'Requested',
		active: 'Active',
		past_due: 'Payment overdue',
		suspended: 'Suspended',
		cancelled: 'Cancelled'
	};

	function statusStyle(status: string): string {
		return statusStyles[status as OBPApiProductSubscriptionStatus] ?? statusStyles.cancelled;
	}

	function statusLabel(status: string): string {
		return statusLabels[status as OBPApiProductSubscriptionStatus] ?? status;
	}

	function billingExplanation(product: NonNullable<typeof selectedProduct>): string {
		if (product.action === 'contact') {
			return 'This product is not open to self-service. Please contact the bank to be enrolled.';
		}
		switch (product.billing_system) {
			case 'none':
				return 'No billing is attached to this product. The subscription becomes active immediately.';
			case 'stripe':
				return data.billingServiceUrl
					? 'This product is paid by card. After you subscribe, you go to the payment page. The subscription becomes active once the payment is confirmed.'
					: 'This product is paid by card, but card payment is not available on this installation yet. A subscription stays requested until it is paid.';
			case 'manual':
				return 'A bank administrator reviews each request. The subscription becomes active once approved.';
			case 'invoice_ninja':
				return 'This product is invoiced. The subscription becomes active once the invoice is settled.';
			default:
				return `Billing system: ${product.billing_system}. The subscription stays requested until it is activated.`;
		}
	}

	const loginHref = $derived(
		'/login?redirect=' +
			encodeURIComponent(
				data.preselect.api_product_code
					? `/subscriptions?bank_id=${encodeURIComponent(data.preselect.bank_id)}&api_product_code=${encodeURIComponent(data.preselect.api_product_code)}`
					: '/subscriptions'
			)
	);
</script>

<svelte:head>
	<title>Subscriptions</title>
	<meta name="description" content="Subscribe your applications to API products and manage your subscriptions" />
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="mb-8 text-center">
		<h1 class="mb-2 text-3xl font-bold ui-text">Subscriptions</h1>
		<p class="mx-auto max-w-2xl ui-muted">
			Subscribe one of your consumers (applications) to an API product. An active subscription applies the
			product's rate limits and endpoint access to that consumer.
		</p>
	</div>

	{#if data.warnings.length > 0}
		<div
			class="mb-6 rounded-lg border p-4 text-sm ui-tone-warning"
			data-testid="subscriptions-warnings"
		>
			<ul class="list-disc space-y-1 pl-5">
				{#each data.warnings as warning}
					<li>{warning}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if form?.message}
		<div
			class="mb-6 rounded-lg border p-4 text-sm {form.success
				? 'ui-tone-success'
				: 'ui-tone-error'}"
			role="status"
			data-testid="subscriptions-form-result"
			data-success={form.success ? 'true' : 'false'}
		>
			<p class="font-medium">{form.message}</p>
			{#if form.success && form.subscription?.api_product_subscription_id}
				<p class="mt-1">
					Subscription ID:
					<code class="rounded bg-white/60 px-1.5 py-0.5 dark:bg-black/30">{form.subscription.api_product_subscription_id}</code>
				</p>
			{/if}
		</div>
	{/if}

	{#if !data.isLoggedIn}
		<div
			class="rounded-lg border p-8 text-center shadow-sm ui-card ui-border"
			data-testid="subscriptions-login-prompt"
		>
			<p class="mb-4 ui-muted">Sign in to view your subscriptions and apply for new ones.</p>
			<a href={loginHref} class="btn preset-filled-primary-500 px-8">Sign in</a>
			<p class="mt-4 text-sm ui-muted">
				Browse the <a href="/products" class="underline">API products</a> first if you like.
			</p>
		</div>
	{:else}
		<!-- Apply for a subscription -->
		<section
			class="mb-10 rounded-lg border p-6 shadow-sm ui-card ui-border"
			data-testid="subscriptions-apply"
		>
			<h2 class="mb-1 text-xl font-semibold ui-text">Apply for a subscription</h2>
			<p class="mb-6 text-sm ui-muted">
				Choose a product and the consumer that should hold it. Free products activate at once; billed or
				reviewed products stay "requested" until they are approved or paid.
			</p>

			{#if data.products.length === 0}
				<p class="text-sm ui-muted" data-testid="subscriptions-no-products">
					There are no API products to subscribe to at the moment.
				</p>
			{:else if data.consumers.length === 0}
				<p class="text-sm ui-muted" data-testid="subscriptions-no-consumers">
					You have no consumers (applications) yet. A subscription is held by a consumer, so please
					<a href="/consumers/register" class="underline">register one</a>
					first.
				</p>
			{:else}
				<form
					method="POST"
					action="?/subscribe"
					class="space-y-5"
					use:enhance={() => {
						submitting = true;
						return async ({ result, update }) => {
							if (result.type === 'redirect') {
								// The payment page of OBP-Stripe is on another site.
								window.location.href = result.location;
								return;
							}
							await update({ reset: false });
							submitting = false;
						};
					}}
				>
					<input type="hidden" name="bank_id" value={selectedProduct?.bank_id ?? ''} />
					<input type="hidden" name="api_product_code" value={selectedProduct?.api_product_code ?? ''} />

					<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
						<label class="label">
							<span class="label-text font-semibold">API product <span class="ui-text-error">*</span></span>
							<select
								class="select"
								bind:value={selectedProductKey}
								required
								data-testid="subscriptions-product-select"
							>
								<option value="" disabled>Choose a product</option>
								{#each banks as bankId}
									<optgroup label="Bank: {bankId}">
										{#each data.products.filter((p) => p.bank_id === bankId) as product (productKey(product.bank_id, product.api_product_code))}
											<option value={productKey(product.bank_id, product.api_product_code)}>
												{product.name} ({formatPrice(product.price_monthly, product.price_currency)})
											</option>
										{/each}
									</optgroup>
								{/each}
							</select>
						</label>

						<label class="label">
							<span class="label-text font-semibold">Consumer (application) <span class="ui-text-error">*</span></span>
							<select
								class="select"
								name="consumer_id"
								bind:value={selectedConsumerId}
								required
								data-testid="subscriptions-consumer-select"
							>
								<option value="" disabled>Choose a consumer</option>
								{#each data.consumers as consumer (consumer.consumer_id)}
									<option value={consumer.consumer_id}>
										{consumer.app_name}{consumer.enabled ? '' : ' (disabled)'}
									</option>
								{/each}
							</select>
							<span class="mt-1 text-xs ui-muted">
								Need another one? <a href="/consumers/register" class="underline">Register a consumer</a>.
							</span>
						</label>
					</div>

					{#if selectedProduct}
						<div
							class="rounded-lg p-4 text-sm ui-card"
							data-testid="subscriptions-product-summary"
						>
							<div class="flex flex-wrap items-baseline justify-between gap-2">
								<div>
									<span class="font-semibold ui-text">{selectedProduct.name}</span>
									{#if selectedProduct.category}
										<span class="ml-2 rounded-full px-2 py-0.5 text-xs ui-tone-info">{selectedProduct.category}</span>
									{/if}
								</div>
								<span class="font-medium ui-text">{formatPrice(selectedProduct.price_monthly, selectedProduct.price_currency)}</span>
							</div>
							{#if selectedProduct.description}
								<p class="mt-2 ui-muted">{selectedProduct.description}</p>
							{/if}
							<p class="mt-2 flex items-start gap-1.5 ui-muted">
								<Info class="mt-0.5 h-4 w-4 flex-shrink-0" />
								<span>{billingExplanation(selectedProduct)}</span>
							</p>
							{#if selectedProduct.attributes_unknown}
								<p class="mt-1 text-xs ui-text-warning">
									The product's billing settings could not be loaded; the outcome may differ from the description above.
								</p>
							{/if}
							<p class="mt-2 text-xs ui-muted">
								<a href="/products/{selectedProduct.api_product_code}" class="underline">Product details</a>
								· Bank <code class="rounded px-1 py-0.5 ui-card">{selectedProduct.bank_id}</code>
								· Code <code class="rounded px-1 py-0.5 ui-card">{selectedProduct.api_product_code}</code>
							</p>
						</div>
					{/if}

					<details class="text-sm">
						<summary class="cursor-pointer ui-muted">Optional: start and end dates</summary>
						<div class="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2">
							<label class="label">
								<span class="label-text">Start date</span>
								<input type="date" class="input" name="start_date" bind:value={startDate} data-testid="subscriptions-start-date" />
								<span class="mt-1 text-xs ui-muted">Defaults to today.</span>
							</label>
							<label class="label">
								<span class="label-text">End date</span>
								<input type="date" class="input" name="end_date" bind:value={endDate} min={startDate || undefined} data-testid="subscriptions-end-date" />
								<span class="mt-1 text-xs ui-muted">Leave empty for an open-ended subscription.</span>
							</label>
						</div>
					</details>

					{#if existingSubscription}
						<p class="text-sm ui-text-warning" data-testid="subscriptions-already-subscribed">
							This consumer already holds a subscription to this product (status: {statusLabel(existingSubscription.status)}).
							Cancel it below before subscribing again.
						</p>
					{/if}

					<div class="flex flex-wrap items-center gap-3">
						<button
							type="submit"
							class="btn preset-filled-primary-500 px-8"
							disabled={!canSubmit}
							data-testid="subscriptions-submit"
							data-action={selectedProduct?.action ?? ''}
						>
							{submitting ? 'Submitting…' : submitLabel}
						</button>
						{#if selectedProduct?.action === 'contact'}
							<span class="text-sm ui-muted">Only the bank can enrol a consumer to this product.</span>
						{/if}
					</div>
				</form>
			{/if}
		</section>

		<!-- Your subscriptions -->
		<section
			class="mb-10 rounded-lg border p-6 shadow-sm ui-card ui-border"
			data-testid="subscriptions-list"
		>
			<h2 class="mb-1 text-xl font-semibold ui-text">Your subscriptions</h2>
			<p class="mb-6 text-sm ui-muted">
				Subscriptions held by consumers you created. Cancelling is final; subscribe again to start a new one.
			</p>

			{#if data.subscriptions.length === 0}
				<p class="text-sm ui-muted" data-testid="subscriptions-empty">You have no subscriptions yet.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm">
						<thead class="border-b text-xs uppercase ui-muted ui-border">
							<tr>
								<th class="py-2 pr-4">Product</th>
								<th class="py-2 pr-4">Consumer</th>
								<th class="py-2 pr-4">Status</th>
								<th class="py-2 pr-4">Period</th>
								<th class="py-2 pr-4">Subscription ID</th>
								<th class="py-2"></th>
							</tr>
						</thead>
						<tbody>
							{#each data.subscriptions as subscription (subscription.api_product_subscription_id)}
								<tr
									class="border-b align-top ui-border"
									data-testid="subscription-row"
									data-status={subscription.status}
								>
									<td class="py-3 pr-4">
										<a href="/products/{subscription.api_product_code}" class="font-medium underline-offset-2 hover:underline ui-text">
											{productName(subscription)}
										</a>
										<div class="text-xs ui-muted">{subscription.bank_id} · {subscription.api_product_code}</div>
									</td>
									<td class="py-3 pr-4">
										<div class="ui-text">{consumerName(subscription.consumer_id)}</div>
										<code class="text-xs ui-muted">{subscription.consumer_id}</code>
									</td>
									<td class="py-3 pr-4">
										<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusStyle(subscription.status)}">
											{statusLabel(subscription.status)}
										</span>
									</td>
									<td class="py-3 pr-4 whitespace-nowrap ui-muted">
										{formatDate(subscription.start_date)}
										{#if subscription.end_date}
											– {formatDate(subscription.end_date)}
										{:else}
											– open
										{/if}
									</td>
									<td class="py-3 pr-4">
										<code class="text-xs ui-muted">{subscription.api_product_subscription_id}</code>
									</td>
									<td class="py-3 text-right">
										{#if billingLink(subscription)}
											{@const link = billingLink(subscription)}
											<a
												href={link?.href}
												class="mb-2 inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium preset-outlined-surface-500"
												data-testid="subscription-billing-link"
												data-billing-action={link?.label === 'Pay' ? 'pay' : 'manage'}
											>
												{link?.label}
												<ExternalLink class="h-3 w-3" />
											</a>
										{/if}
										{#if subscription.status !== 'cancelled'}
											<form
												method="POST"
												action="?/cancel"
												use:enhance={({ cancel }) => {
													if (!confirm(`Cancel the subscription of ${consumerName(subscription.consumer_id)} to ${productName(subscription)}? This cannot be undone.`)) {
														cancel();
														return;
													}
													cancellingId = subscription.api_product_subscription_id;
													return async ({ update }) => {
														await update({ reset: false });
														cancellingId = '';
													};
												}}
											>
												<input type="hidden" name="api_product_subscription_id" value={subscription.api_product_subscription_id} />
												<button
													type="submit"
													class="rounded-md px-3 py-1 text-xs font-medium disabled:opacity-60 preset-filled-error-500"
													disabled={cancellingId === subscription.api_product_subscription_id}
													data-testid="subscription-cancel"
												>
													{cancellingId === subscription.api_product_subscription_id ? 'Cancelling…' : 'Cancel'}
												</button>
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
	{/if}
</div>
