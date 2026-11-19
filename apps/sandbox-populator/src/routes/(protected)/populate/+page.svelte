<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import type {
		InvestigationCaseResults,
		PopulateResults,
		TransactionRequestResults
	} from './+page.server';
	import { buildAppUrls } from '$lib/obp/appDirectory';
	import {
		Database,
		Loader2,
		CheckCircle,
		XCircle,
		Building,
		Wallet,
		Users,
		TrendingUp,
		History,
		Copy,
		Check,
		ExternalLink,
		Plus,
		RotateCcw,
		Send,
		ArrowRightLeft,
		UserCheck,
		Building2,
		ShieldAlert,
		Link
	} from '@lucide/svelte';
	import { deserialize } from '$app/forms';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// The last action's results. The page shows the populate results or the transaction request
	// results, depending on which action ran, so the type covers both.
	const results = $derived(
		form?.results as (PopulateResults & Partial<TransactionRequestResults>) | undefined
	);

	let isLoading = $state(false);
	let isLoadingPreview = $state(false);
	let isLoadingCounterpartyTxn = $state(false);
	let isLoadingAccountTxn = $state(false);
	let isLoadingInvestigation = $state(false);
	let showPreview = $state(false);
	let previewData = $state<any>(null);
	let numBanks = $state(data.defaults.numBanks);
	let numAccountsPerBank = $state(data.defaults.numAccountsPerBank);
	let numUsers = $state(data.defaults.numUsers);
	let countryCode = $state(data.defaults.countryCode);
	let currency = $state(data.defaults.currency);
	let bankIdPrefix = $state(data.defaults.bankIdPrefix);

	// Map country code to default currency
	const countryCurrencyMap: Record<string, string> = {};
	for (const c of data.countries) {
		countryCurrencyMap[c.code] = c.currency;
	}

	// Default fraud case bank IDs follow the selected country
	const caseBankIdsMap: Record<string, string> = {};
	for (const c of data.caseExamples) {
		caseBankIdsMap[c.code] = c.bankIds.join(', ');
	}
	let caseBankIds = $state(caseBankIdsMap[data.defaults.countryCode] ?? '');
	let countryName = $derived(data.countries.find((c) => c.code === countryCode)?.name ?? countryCode);

	function onCountryChange(code: string) {
		countryCode = code;
		if (countryCurrencyMap[code]) {
			currency = countryCurrencyMap[code];
		}
		if (caseBankIdsMap[code]) {
			caseBankIds = caseBankIdsMap[code];
		}
	}
	let createCounterparties = $state(true);
	let createCustomers = $state(true);
	let createFxRates = $state(true);
	let createTransactions = $state(true);
	let createUsers = $state(true);
	let createUserCustomerLinks = $state(true);
	let createCustomerLinks = $state(true);

	// Copy states for each section
	let copiedSection = $state<string | null>(null);

	async function copyToClipboard(section: string, text: string) {
		await navigator.clipboard.writeText(text);
		copiedSection = section;
		setTimeout(() => {
			copiedSection = null;
		}, 2000);
	}

	function formatBanks() {
		if (!results?.banks) return '';
		return results.banks.map(b => `bank_id: ${b.bank_id}, bank_code: ${b.bank_code}`).join('\n');
	}

	function formatAccounts() {
		if (!results?.accounts) return '';
		return results.accounts.map(a => `account_id: ${a.account_id}, label: ${a.label}, currency: ${a.currency}`).join('\n');
	}

	function formatCounterparties() {
		if (!results?.counterparties) return '';
		return results.counterparties.map(c => `name: ${c.name}`).join('\n');
	}

	function formatCustomers() {
		if (!results?.customers) return '';
		return results.customers.map(c => `${c.customer_type}: ${c.legal_name}`).join('\n');
	}

	function formatFxRates() {
		if (!results?.fxRates) return '';
		return results.fxRates.map(fx => `${fx.from_currency} → ${fx.to_currency}: ${fx.rate}`).join('\n');
	}

	function formatTransactions() {
		if (!results?.transactions) return '';
		return results.transactions.map(t => `transaction_id: ${t.transaction_id}, amount: ${t.amount}`).join('\n');
	}

	function formatUsers() {
		if (!results?.users) return '';
		return results.users.map(u => `username: ${u.username}, email: ${u.email}`).join('\n');
	}

	function formatUserCustomerLinks() {
		if (!results?.userCustomerLinks) return '';
		return results.userCustomerLinks.map(l => `${l.username} → ${l.legal_name}`).join('\n');
	}

	function formatCustomerLinks() {
		if (!results?.customerLinks) return '';
		return results.customerLinks.map(l => `${l.customer_name} → ${l.other_customer_name} (${l.relationship_to})`).join('\n');
	}

	function formatErrors() {
		if (!results?.errors) return '';
		return results.errors.join('\n');
	}

	// API Manager URL from app directory
	const appUrls = buildAppUrls(data.appDirectory || []);
	const apiManagerBase = appUrls.apiManager || '';

	function getBankUrl(bank: { bank_id: string }) {
		return `${apiManagerBase}/banks/${bank.bank_id}`;
	}

	function getAccountUrl(account: { account_id: string; bank_id: string }) {
		return `${apiManagerBase}/account-access/accounts/${account.bank_id}/${account.account_id}/owner`;
	}

	function getTransactionUrl(txn: { bank_id: string; from_account_id: string }) {
		return `${apiManagerBase}/account-access/accounts/${txn.bank_id}/${txn.from_account_id}/owner/transactions`;
	}

	function getCounterpartyUrl(cp: { bank_id: string; account_id: string }) {
		return `${apiManagerBase}/account-access/accounts/${cp.bank_id}/${cp.account_id}/owner/counterparties`;
	}

	function getCustomersUrl(type: 'individual' | 'corporate') {
		return `${apiManagerBase}/customers/${type}`;
	}

	function getFxRatesUrl() {
		return `${apiManagerBase}/banks/fx-rates`;
	}

	// Check if there's any existing data
	function hasExistingData() {
		return data.existing && (
			data.existing.banks.length > 0 ||
			data.existing.accounts.length > 0 ||
			data.existing.counterparties.length > 0 ||
			data.existing.customers.length > 0 ||
			data.existing.fxRates.length > 0 ||
			data.existing.transactions.length > 0
		);
	}

	// Format functions for existing data
	function formatExistingBanks() {
		if (!data.existing?.banks) return '';
		return data.existing.banks.map(b => `bank_id: ${b.bank_id}, bank_code: ${b.bank_code}`).join('\n');
	}

	function formatExistingAccounts() {
		if (!data.existing?.accounts) return '';
		return data.existing.accounts.map(a => `account_id: ${a.account_id}, label: ${a.label}, currency: ${a.currency}`).join('\n');
	}

	function formatExistingCounterparties() {
		if (!data.existing?.counterparties) return '';
		return data.existing.counterparties.map(c => `name: ${c.name}`).join('\n');
	}

	function formatExistingCustomers() {
		if (!data.existing?.customers) return '';
		return data.existing.customers.map(c => `${c.customer_type}: ${c.legal_name}`).join('\n');
	}

	function formatExistingFxRates() {
		if (!data.existing?.fxRates) return '';
		return data.existing.fxRates.map(fx => `${fx.from_currency} → ${fx.to_currency}: ${fx.rate}`).join('\n');
	}

	function formatExistingTransactions() {
		if (!data.existing?.transactions) return '';
		return data.existing.transactions.map(t => `transaction_id: ${t.transaction_id}, amount: ${t.amount}`).join('\n');
	}

</script>

<div class="p-8 w-full">
	<h1 class="h1 mb-2">Populate Sandbox</h1>
	<p class="text-surface-400 mb-8">
		Configure and create test data for your OBP sandbox as <span class="text-secondary-400"
			>{data.username}</span
		>
	</p>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<!-- Configuration Panel -->
		<div class="card p-6 preset-filled-surface-50-950">
			<h2 class="h3 mb-4 flex items-center gap-2">
				<Database class="size-5 text-secondary-500" />
				Configuration
			</h2>

			<form
				method="POST"
				action="?/populate"
				use:enhance={() => {
					isLoading = true;
					return async ({ update }) => {
						await update();
						isLoading = false;
					};
				}}
				class="space-y-4"
			>
				<!-- Bank ID Prefix & Number of Banks -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="bankIdPrefix" class="block text-sm font-medium mb-1">Bank ID Prefix</label>
						<input
							type="text"
							id="bankIdPrefix"
							name="bankIdPrefix"
							bind:value={bankIdPrefix}
							class="input w-full"
							disabled={isLoading}
						/>
					</div>
					<div>
						<label for="numBanks" class="block text-sm font-medium mb-1">Number of Banks</label>
						<input
							type="number"
							id="numBanks"
							name="numBanks"
							bind:value={numBanks}
							min="1"
							max="5"
							class="input w-full"
							disabled={isLoading}
						/>
					</div>
				</div>
				<p class="text-xs text-surface-500 -mt-2">Banks will be: <code class="bg-surface-700 px-1 rounded">{bankIdPrefix}-bnk-1</code>, <code class="bg-surface-700 px-1 rounded">{bankIdPrefix}-bnk-2</code>, ...</p>

				<!-- Country & Currency -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="country" class="block text-sm font-medium mb-1">Country</label>
						<select
							id="country"
							name="country"
							bind:value={countryCode}
							onchange={() => onCountryChange(countryCode)}
							class="select w-full"
							disabled={isLoading}
						>
							{#each data.countries as country}
								<option value={country.code}>{country.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="currency" class="block text-sm font-medium mb-1">Currency</label>
						<select
							id="currency"
							name="currency"
							bind:value={currency}
							class="select w-full"
							disabled={isLoading}
						>
							<option value="BWP">BWP - Botswana Pula</option>
							<option value="USD">USD - US Dollar</option>
							<option value="EUR">EUR - Euro</option>
							<option value="GBP">GBP - British Pound</option>
							<option value="JPY">JPY - Japanese Yen</option>
							<option value="SGD">SGD - Singapore Dollar</option>
							<option value="ZAR">ZAR - South African Rand</option>
							<option value="NGN">NGN - Nigerian Naira</option>
							<option value="TZS">TZS - Tanzanian Shilling</option>
							<option value="OMR">OMR - Omani Rial</option>
						</select>
					</div>
				</div>

				<!-- Accounts per Bank & Number of Users -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="numAccountsPerBank" class="block text-sm font-medium mb-1">Accounts per Bank</label>
						<input
							type="number"
							id="numAccountsPerBank"
							name="numAccountsPerBank"
							bind:value={numAccountsPerBank}
							min="1"
							max="10"
							class="input w-full"
							disabled={isLoading}
						/>
					</div>
					<div>
						<label for="numUsers" class="block text-sm font-medium mb-1">Number of Users</label>
						<input
							type="number"
							id="numUsers"
							name="numUsers"
							bind:value={numUsers}
							min="1"
							max="20"
							class="input w-full"
							disabled={isLoading}
						/>
					</div>
				</div>

				<hr class="border-surface-700" />

				<!-- Optional Features -->
				<div class="space-y-3">
					<p class="text-sm font-medium">Additional Data</p>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							name="createCounterparties"
							bind:checked={createCounterparties}
							class="checkbox"
							disabled={isLoading}
						/>
						<span class="flex items-center gap-2">
							<Users class="size-4 text-tertiary-500" />
							Create Counterparties (local businesses)
						</span>
					</label>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							name="createCustomers"
							bind:checked={createCustomers}
							class="checkbox"
							disabled={isLoading}
						/>
						<span class="flex items-center gap-2">
							<UserCheck class="size-4 text-tertiary-500" />
							Create Customers (my + 5 individual + 5 corporate)
						</span>
					</label>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							name="createFxRates"
							bind:checked={createFxRates}
							class="checkbox"
							disabled={isLoading}
						/>
						<span class="flex items-center gap-2">
							<TrendingUp class="size-4 text-tertiary-500" />
							Create FX Rates
						</span>
					</label>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							name="createTransactions"
							bind:checked={createTransactions}
							class="checkbox"
							disabled={isLoading}
						/>
						<span class="flex items-center gap-2">
							<History class="size-4 text-tertiary-500" />
							Create Historical Transactions (12 months)
						</span>
					</label>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							name="createUsers"
							bind:checked={createUsers}
							class="checkbox"
							disabled={isLoading}
						/>
						<span class="flex items-center gap-2">
							<Users class="size-4 text-tertiary-500" />
							Create Users (password: <code class="bg-surface-700 px-1 rounded text-xs">Test1234!</code>)
						</span>
					</label>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							name="createUserCustomerLinks"
							bind:checked={createUserCustomerLinks}
							class="checkbox"
							disabled={isLoading || !createUsers}
						/>
						<span class="flex items-center gap-2">
							<UserCheck class="size-4 text-tertiary-500" />
							Create User-Customer Links
						</span>
					</label>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							name="createCustomerLinks"
							bind:checked={createCustomerLinks}
							class="checkbox"
							disabled={isLoading || !createCustomers}
						/>
						<span class="flex items-center gap-2">
							<Link class="size-4 text-tertiary-500" />
							Create Customer Links (spouse, associate, etc.)
						</span>
					</label>
				</div>

				<div class="grid grid-cols-2 gap-3 mt-6">
					<!-- Preview button — separate form, same fields, different action -->
					<button
						type="button"
						formaction="?/preview"
						class="btn preset-outlined-surface-500 w-full"
						disabled={isLoading || isLoadingPreview || isLoadingCounterpartyTxn || isLoadingAccountTxn}
						onclick={async (e) => {
							isLoadingPreview = true;
							const formEl = e.currentTarget.closest('form') as HTMLFormElement;
							const formData = new FormData(formEl);
							const response = await fetch('?/preview', { method: 'POST', body: formData });
							const result = deserialize(await response.text());
							if (result.type === 'success' && (result.data as any)?.preview) {
								previewData = (result.data as any).preview;
								showPreview = true;
							}
							isLoadingPreview = false;
						}}
					>
						{#if isLoadingPreview}
							<Loader2 class="size-4 animate-spin mr-2" />
							Previewing...
						{:else}
							<Send class="size-4 mr-2" />
							Preview
						{/if}
					</button>

					<button
						type="submit"
						class="btn preset-filled-primary-500 w-full"
						disabled={isLoading || isLoadingPreview || isLoadingCounterpartyTxn || isLoadingAccountTxn}
					>
						{#if isLoading}
							<Loader2 class="size-5 animate-spin mr-2" />
							Populating...
						{:else}
							<Database class="size-5 mr-2" />
							Populate Sandbox
						{/if}
					</button>
				</div>
			</form>

			<!-- Preview Panel -->
			{#if showPreview && previewData}
				{@const preview = previewData}
				<div class="mt-6 card p-4 preset-filled-surface-100-900 border border-surface-500">
					<div class="flex items-center justify-between mb-3">
						<h3 class="font-semibold flex items-center gap-2">
							<Send class="size-4 text-secondary-400" />
							Preview — what will be created
						</h3>
						<button class="btn btn-sm preset-outlined-surface-500" onclick={() => showPreview = false}>
							Close
						</button>
					</div>

					<!-- Summary -->
					<div class="grid grid-cols-3 gap-2 mb-4 text-sm">
						<div class="card p-2 preset-filled-surface-200-800 text-center">
							<div class="text-lg font-bold text-secondary-400">{preview.summary.banks}</div>
							<div class="text-surface-400">Banks</div>
						</div>
						<div class="card p-2 preset-filled-surface-200-800 text-center">
							<div class="text-lg font-bold text-secondary-400">{preview.summary.accounts}</div>
							<div class="text-surface-400">Accounts</div>
						</div>
						<div class="card p-2 preset-filled-surface-200-800 text-center">
							<div class="text-lg font-bold text-secondary-400">{preview.summary.customers}</div>
							<div class="text-surface-400">Customers</div>
						</div>
						<div class="card p-2 preset-filled-surface-200-800 text-center">
							<div class="text-lg font-bold text-secondary-400">{preview.summary.counterparties}</div>
							<div class="text-surface-400">Counterparties</div>
						</div>
						<div class="card p-2 preset-filled-surface-200-800 text-center">
							<div class="text-lg font-bold text-secondary-400">{preview.summary.fxRatePairs}</div>
							<div class="text-surface-400">FX Pairs</div>
						</div>
						<div class="card p-2 preset-filled-surface-200-800 text-center">
							<div class="text-lg font-bold text-secondary-400">{preview.summary.transactions}</div>
							<div class="text-surface-400">Transactions</div>
						</div>
						<div class="card p-2 preset-filled-surface-200-800 text-center">
							<div class="text-lg font-bold text-secondary-400">{preview.summary.users}</div>
							<div class="text-surface-400">Users</div>
						</div>
						<div class="card p-2 preset-filled-surface-200-800 text-center">
							<div class="text-lg font-bold text-secondary-400">{preview.summary.userCustomerLinks}</div>
							<div class="text-surface-400">User Links</div>
						</div>
						<div class="card p-2 preset-filled-surface-200-800 text-center">
							<div class="text-lg font-bold text-secondary-400">{preview.summary.customerLinks}</div>
							<div class="text-surface-400">Customer Links</div>
						</div>
					</div>

					<p class="text-xs text-surface-400 mb-3">
						Total: <strong>{preview.summary.total}</strong> entities will be created in OBP.
						{#if preview.transactions}
							Transaction amounts are randomised at populate time.
						{/if}
					</p>

					<!-- Full JSON -->
					<details class="text-xs">
						<summary class="cursor-pointer text-surface-400 hover:text-white mb-2 flex items-center gap-2">
							<span>Show full JSON plan</span>
							<button
								type="button"
								class="ml-2 px-2 py-0.5 text-xs bg-surface-700 hover:bg-surface-600 text-surface-200 rounded"
								onclick={(e) => { e.preventDefault(); copyToClipboard('fullJson', JSON.stringify(preview, null, 2)); }}
							>{copiedSection === 'fullJson' ? 'Copied!' : 'Copy'}</button>
						</summary>
						<pre class="bg-surface-900 p-3 rounded overflow-auto max-h-96 text-xs">{JSON.stringify(preview, null, 2)}</pre>
					</details>
				</div>
			{/if}

			<hr class="border-surface-700 my-4" />

			<p class="text-sm font-medium mb-3">Fraud case setup</p>
			<form
				method="POST"
				action="?/populateInvestigationCase"
				use:enhance={() => {
					isLoadingInvestigation = true;
					return async ({ update }) => {
						await update();
						isLoadingInvestigation = false;
					};
				}}
			>
				<input type="hidden" name="country" value={countryCode} />
				<input type="hidden" name="currency" value={currency} />
				<div class="mb-2">
					<label for="casePrefix" class="block text-xs font-medium mb-1">Bank ID Prefix</label>
					<input
						type="text"
						id="casePrefix"
						name="casePrefix"
						bind:value={bankIdPrefix}
						class="input w-full text-sm"
						placeholder="e.g. run1"
						disabled={isLoadingInvestigation}
					/>
				</div>
				<div class="mb-2">
					<label for="caseBankIds" class="block text-xs font-medium mb-1">Bank IDs (comma-separated, min 3)</label>
					<input
						type="text"
						id="caseBankIds"
						name="caseBankIds"
						bind:value={caseBankIds}
						class="input w-full text-sm"
						placeholder="bank1, bank2, bank3"
						disabled={isLoadingInvestigation}
					/>
					<p class="text-xs text-surface-500 mt-1">Bank 1 = normal layer, Bank 2 = suspicious layer, Bank 3 = expansion. Prefix applied: <code class="bg-surface-700 px-1 rounded">{bankIdPrefix}-bank1</code></p>
				</div>
				<button
					type="submit"
					class="btn preset-filled-warning-500 w-full text-sm mb-2"
					disabled={isLoading || isLoadingInvestigation || isLoadingCounterpartyTxn || isLoadingAccountTxn}
				>
					{#if isLoadingInvestigation}
						<Loader2 class="size-4 animate-spin mr-1" />
						Populating Investigation Case...
					{:else}
						<ShieldAlert class="size-4 mr-1" />
						Populate Case Example
					{/if}
				</button>
				<p class="text-xs text-surface-500 mb-1">Creates a fraud investigation dataset across your banks, using the selected country ({countryName}) and currency ({currency}):</p>
				<ul class="text-xs text-surface-500 space-y-0.5 ml-4 list-disc">
					<li>3 banks (your IDs, prefixed)</li>
					<li>6 customers (individuals + shell companies)</li>
					<li>10 accounts with customer-account links</li>
					<li>3 customer links (spouse, close_associate, business_partner)</li>
					<li>30 transactions: normal salary layer + suspicious consulting fees + investigative expansion</li>
				</ul>
			</form>

			<hr class="border-surface-700 my-4" />

			<p class="text-sm font-medium mb-3">Transaction Requests</p>
			<div class="grid grid-cols-2 gap-3">
				<form
					method="POST"
					action="?/createCounterpartyTransactionRequests"
					use:enhance={() => {
						isLoadingCounterpartyTxn = true;
						return async ({ update }) => {
							await update();
							isLoadingCounterpartyTxn = false;
						};
					}}
				>
					<button
						type="submit"
						class="btn preset-tonal-secondary w-full text-sm"
						disabled={isLoading || isLoadingCounterpartyTxn || isLoadingAccountTxn}
					>
						{#if isLoadingCounterpartyTxn}
							<Loader2 class="size-4 animate-spin mr-1" />
						{:else}
							<Users class="size-4 mr-1" />
						{/if}
						10 to Counterparties
					</button>
				</form>

				<form
					method="POST"
					action="?/createAccountTransactionRequests"
					use:enhance={() => {
						isLoadingAccountTxn = true;
						return async ({ update }) => {
							await update();
							isLoadingAccountTxn = false;
						};
					}}
				>
					<button
						type="submit"
						class="btn preset-tonal-secondary w-full text-sm"
						disabled={isLoading || isLoadingCounterpartyTxn || isLoadingAccountTxn}
					>
						{#if isLoadingAccountTxn}
							<Loader2 class="size-4 animate-spin mr-1" />
						{:else}
							<ArrowRightLeft class="size-4 mr-1" />
						{/if}
						10 to Accounts
					</button>
				</form>
			</div>
		</div>

		<!-- Results Panel -->
		<div class="card p-6 preset-filled-surface-50-950">
			<h2 class="h3 mb-4 flex items-center gap-2">
				{#if form?.success}
					<CheckCircle class="size-5 text-success-500" />
					Results
				{:else if form?.error}
					<XCircle class="size-5 text-error-500" />
					Results
				{:else if hasExistingData()}
					<Database class="size-5 text-secondary-500" />
					Existing Data
				{:else}
					<Database class="size-5 text-surface-500" />
					Results
				{/if}
			</h2>

			{#if isLoading}
				<div class="py-6 text-surface-400">
					<p class="text-sm mb-4">Populating sandbox data...</p>
					<ul class="space-y-3">
						<li class="flex items-center gap-3">
							<Loader2 class="size-4 animate-spin text-primary-400" />
							<span>Creating {numBanks} bank{numBanks > 1 ? 's' : ''}...</span>
						</li>
						<li class="flex items-center gap-3">
							<Loader2 class="size-4 animate-spin text-primary-400" />
							<span>Creating {numAccountsPerBank} account{numAccountsPerBank > 1 ? 's' : ''} per bank...</span>
						</li>
						{#if createCounterparties}
							<li class="flex items-center gap-3">
								<Loader2 class="size-4 animate-spin text-primary-400" />
								<span>Adding business counterparties...</span>
							</li>
						{/if}
						{#if createCustomers}
							<li class="flex items-center gap-3">
								<Loader2 class="size-4 animate-spin text-primary-400" />
								<span>Creating individual and corporate customers...</span>
							</li>
						{/if}
						{#if createFxRates}
							<li class="flex items-center gap-3">
								<Loader2 class="size-4 animate-spin text-primary-400" />
								<span>Setting up FX rates...</span>
							</li>
						{/if}
						{#if createTransactions}
							<li class="flex items-center gap-3">
								<Loader2 class="size-4 animate-spin text-primary-400" />
								<span>Generating 12 months of historical transactions...</span>
							</li>
						{/if}
						{#if createUsers}
							<li class="flex items-center gap-3">
								<Loader2 class="size-4 animate-spin text-primary-400" />
								<span>Creating {numUsers} user{numUsers > 1 ? 's' : ''}...</span>
							</li>
						{/if}
						{#if createUsers && createUserCustomerLinks}
							<li class="flex items-center gap-3">
								<Loader2 class="size-4 animate-spin text-primary-400" />
								<span>Linking users to customers...</span>
							</li>
						{/if}
					</ul>
					<p class="text-xs text-surface-500 mt-6">This may take a moment depending on the number of items...</p>
				</div>
			{:else if isLoadingInvestigation}
				<div class="py-6 text-surface-400">
					<p class="text-sm mb-4 flex items-center gap-2"><ShieldAlert class="size-4 text-warning-400" /> Populating investigation case...</p>
					<ul class="space-y-3">
						<li class="flex items-center gap-3">
							<Loader2 class="size-4 animate-spin text-primary-400" />
							<span>Creating 3 banks ({countryName}, {currency})...</span>
						</li>
						<li class="flex items-center gap-3">
							<Loader2 class="size-4 animate-spin text-primary-400" />
							<span>Creating 10 accounts...</span>
						</li>
						<li class="flex items-center gap-3">
							<Loader2 class="size-4 animate-spin text-primary-400" />
							<span>Creating 6 customers (individuals + corporates)...</span>
						</li>
						<li class="flex items-center gap-3">
							<Loader2 class="size-4 animate-spin text-primary-400" />
							<span>Linking customers to accounts...</span>
						</li>
						<li class="flex items-center gap-3">
							<Loader2 class="size-4 animate-spin text-primary-400" />
							<span>Creating 30 transactions (salary + suspicious + expansion)...</span>
						</li>
					</ul>
					<p class="text-xs text-surface-500 mt-6">This may take a moment...</p>
				</div>
			{:else if isLoadingCounterpartyTxn || isLoadingAccountTxn}
				<div class="py-6 text-surface-400">
					<p class="text-sm mb-4">Creating transaction requests...</p>
					<ul class="space-y-3">
						<li class="flex items-center gap-3">
							<Loader2 class="size-4 animate-spin text-primary-400" />
							<span>Creating 10 transaction requests...</span>
						</li>
					</ul>
				</div>
			{:else if form?.success && form?.action === 'investigationCase' && form.results}
				{@const invResults = form.results as InvestigationCaseResults}
				<div class="space-y-4 max-h-[60vh] overflow-y-auto">
					<p class="text-sm text-surface-400 mb-2 flex items-center gap-2">
						<ShieldAlert class="size-4 text-warning-400" />
						Fraud Case — {form.caseCountry} ({form.caseCurrency})
					</p>

					<!-- Banks -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center gap-2 mb-2">
							<Building class="size-4 text-secondary-500" />
							<span class="font-medium">Banks: {invResults.banks.length}</span>
							{#if invResults.banks.filter(b => !b.existed).length > 0}
								<span class="text-xs text-success-400">{invResults.banks.filter(b => !b.existed).length} new</span>
							{/if}
							{#if invResults.banks.filter(b => b.existed).length > 0}
								<span class="text-xs text-warning-400">{invResults.banks.filter(b => b.existed).length} existing</span>
							{/if}
						</div>
						<ul class="text-sm text-surface-400 ml-6 space-y-1">
							{#each invResults.banks as bank}
								<li class="flex items-center gap-1">
									{#if bank.existed}
										<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
									{:else}
										<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
									{/if}
									<a href={getBankUrl(bank)} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1">
										<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{bank.bank_id}</code>
										<ExternalLink class="size-3" />
									</a>
									<span class="text-surface-500 mx-1">|</span>
									<span class="text-surface-300">{bank.full_name}</span>
								</li>
							{/each}
						</ul>
					</div>

					<!-- Accounts -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center gap-2 mb-2">
							<Wallet class="size-4 text-secondary-500" />
							<span class="font-medium">Accounts: {invResults.accounts.length}</span>
							{#if invResults.accounts.filter(a => !a.existed).length > 0}
								<span class="text-xs text-success-400">{invResults.accounts.filter(a => !a.existed).length} new</span>
							{/if}
						</div>
						<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-32 overflow-y-auto">
							{#each invResults.accounts as account}
								<li class="flex items-center gap-1">
									{#if account.existed}
										<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
									{:else}
										<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
									{/if}
									<a href={getAccountUrl(account)} target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1">
										<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{account.account_id}</code>
										<ExternalLink class="size-3" />
									</a>
									<span class="text-surface-500 mx-1">|</span>
									<span class="text-surface-300">{account.label}</span>
								</li>
							{/each}
						</ul>
					</div>

					<!-- Customers -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center gap-2 mb-2">
							<UserCheck class="size-4 text-secondary-500" />
							<span class="font-medium">Customers: {invResults.customers.length}</span>
							{#if invResults.customers.filter(c => !c.existed).length > 0}
								<span class="text-xs text-success-400">{invResults.customers.filter(c => !c.existed).length} new</span>
							{/if}
						</div>
						<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-32 overflow-y-auto">
							{#each invResults.customers as cust}
								<li class="flex items-center gap-1">
									{#if cust.existed}
										<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
									{:else}
										<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
									{/if}
									{#if cust.customer_type === 'CORPORATE'}
										<Building2 class="size-3 text-tertiary-400" />
									{:else}
										<UserCheck class="size-3 text-tertiary-400" />
									{/if}
									<a
										href={getCustomersUrl(cust.customer_type === 'CORPORATE' ? 'corporate' : 'individual')}
										target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
									>
										<span>{cust.legal_name}</span>
										<ExternalLink class="size-3" />
									</a>
									<span class="text-surface-500 mx-1">|</span>
									<span class="text-xs px-1 rounded {cust.customer_type === 'CORPORATE' ? 'bg-tertiary-700' : 'bg-secondary-700'}">{cust.customer_type}</span>
									<span class="text-surface-500 mx-1">@</span>
									<span class="text-xs text-surface-500">{cust.bank_id}</span>
								</li>
							{/each}
						</ul>
					</div>

					<!-- Customer-Account Links -->
					{#if invResults.customerAccountLinks && invResults.customerAccountLinks.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center gap-2 mb-2">
								<ArrowRightLeft class="size-4 text-secondary-500" />
								<span class="font-medium">Customer-Account Links: {invResults.customerAccountLinks.length}</span>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-32 overflow-y-auto">
								{#each invResults.customerAccountLinks as link}
									<li class="flex items-center gap-1">
										{#if link.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<span class="text-surface-300">{link.legal_name}</span>
										<span class="text-surface-400 mx-1">→</span>
										<span class="text-surface-300">{link.account_label}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Customer Links -->
					{#if invResults.customerLinks && invResults.customerLinks.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center gap-2 mb-2">
								<Link class="size-4 text-secondary-500" />
								<span class="font-medium">Customer Links: {invResults.customerLinks.length}</span>
								{#if invResults.customerLinks.filter(l => !l.existed).length > 0}
									<span class="text-xs text-success-400">{invResults.customerLinks.filter(l => !l.existed).length} new</span>
								{/if}
								{#if invResults.customerLinks.filter(l => l.existed).length > 0}
									<span class="text-xs text-warning-400">{invResults.customerLinks.filter(l => l.existed).length} existing</span>
								{/if}
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-32 overflow-y-auto">
								{#each invResults.customerLinks as link}
									<li class="flex items-center gap-1">
										{#if link.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<span class="text-surface-300">{link.customer_name}</span>
										<span class="text-surface-400 mx-1">→</span>
										<span class="text-surface-300">{link.other_customer_name}</span>
										<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded ml-1">{link.relationship_to}</code>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Transactions -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center gap-2 mb-2">
							<History class="size-4 text-secondary-500" />
							<span class="font-medium">Transactions: {invResults.transactions.length}</span>
							{#if invResults.transactions.filter(t => !t.existed).length > 0}
								<span class="text-xs text-success-400">{invResults.transactions.filter(t => !t.existed).length} new</span>
							{/if}
						</div>
						<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-48 overflow-y-auto">
							{#each invResults.transactions as txn}
								<li class="flex items-center gap-1">
									<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
									<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{txn.transaction_id}</code>
									<span class="text-surface-500 mx-1">|</span>
									<span class="text-tertiary-400">{txn.amount}</span>
									<span class="text-surface-500 mx-1">|</span>
									<span class="text-surface-300 truncate max-w-48">{txn.description}</span>
								</li>
							{/each}
						</ul>
					</div>

					<!-- Errors -->
					{#if invResults.errors && invResults.errors.length > 0}
						<div class="p-3 rounded-lg bg-error-900/30 border border-error-700">
							<div class="flex items-center gap-2 mb-2">
								<XCircle class="size-4 text-error-500" />
								<span class="font-medium text-error-400">Errors: {invResults.errors.length}</span>
							</div>
							<ul class="text-sm text-error-300 ml-6 space-y-1 max-h-32 overflow-y-auto">
								{#each invResults.errors.slice(0, 10) as error}
									<li class="truncate">{error}</li>
								{/each}
								{#if invResults.errors.length > 10}
									<li class="text-error-400">...and {invResults.errors.length - 10} more</li>
								{/if}
							</ul>
						</div>
					{/if}
				</div>
			{:else if form?.success && form?.action && results?.transactionRequests}
				<div class="space-y-4 max-h-[60vh] overflow-y-auto">
					<p class="text-sm text-surface-400 mb-2">
						Created {results.transactionRequests.length} {form.action === 'counterpartyTransactionRequests' ? 'COUNTERPARTY' : 'ACCOUNT'} transaction requests
					</p>

					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center gap-2 mb-2">
							<Send class="size-4 text-secondary-500" />
							<span class="font-medium">Transaction Requests: {results.transactionRequests.length}</span>
						</div>
						{#if results.transactionRequests.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-48 overflow-y-auto">
								{#each results.transactionRequests as txnReq}
									<li class="flex items-center gap-1">
										<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{txnReq.id}</code>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-tertiary-400">{txnReq.amount}</span>
										<span class="text-surface-500 mx-1">→</span>
										<span class="text-surface-300">{txnReq.counterparty || txnReq.toAccount}</span>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-xs px-1 rounded {txnReq.status === 'COMPLETED' ? 'bg-success-700' : 'bg-warning-700'}">{txnReq.status}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					{#if results.errors && results.errors.length > 0}
						<div class="p-3 rounded-lg bg-error-900/30 border border-error-700">
							<div class="flex items-center gap-2 mb-2">
								<XCircle class="size-4 text-error-500" />
								<span class="font-medium text-error-400">Errors: {results.errors.length}</span>
							</div>
							<ul class="text-sm text-error-300 ml-6 space-y-1 max-h-32 overflow-y-auto">
								{#each results.errors as error}
									<li class="truncate">{error}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{:else if form?.success && results}
				<div class="space-y-4 max-h-[60vh] overflow-y-auto">
					<!-- Banks -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<Building class="size-4 text-secondary-500" />
								<span class="font-medium">Banks: {results.banks.length}</span>
								{#if results.banks.filter(b => !b.existed).length > 0}
									<span class="text-xs text-success-400">{results.banks.filter(b => !b.existed).length} new</span>
								{/if}
								{#if results.banks.filter(b => b.existed).length > 0}
									<span class="text-xs text-warning-400">{results.banks.filter(b => b.existed).length} existing</span>
								{/if}
							</div>
							{#if results.banks.length > 0}
								<button
									type="button"
									onclick={() => copyToClipboard('banks', formatBanks())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy banks"
								>
									{#if copiedSection === 'banks'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							{/if}
						</div>
						{#if results.banks.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1">
								{#each results.banks as bank}
									<li class="flex items-center gap-1">
										{#if bank.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<a
											href={getBankUrl(bank)}
											target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{bank.bank_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-surface-300">{bank.bank_code}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<!-- Accounts -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<Wallet class="size-4 text-secondary-500" />
								<span class="font-medium">Accounts: {results.accounts.length}</span>
								{#if results.accounts.filter(a => !a.existed).length > 0}
									<span class="text-xs text-success-400">{results.accounts.filter(a => !a.existed).length} new</span>
								{/if}
								{#if results.accounts.filter(a => a.existed).length > 0}
									<span class="text-xs text-warning-400">{results.accounts.filter(a => a.existed).length} existing</span>
								{/if}
							</div>
							{#if results.accounts.length > 0}
								<button
									type="button"
									onclick={() => copyToClipboard('accounts', formatAccounts())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy accounts"
								>
									{#if copiedSection === 'accounts'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							{/if}
						</div>
						{#if results.accounts.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each results.accounts as account}
									<li class="flex items-center gap-1">
										{#if account.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<a
											href={getAccountUrl(account)}
											target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{account.account_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-surface-300">{account.label}</span>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-tertiary-400">{account.currency}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<!-- Counterparties -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<Users class="size-4 text-secondary-500" />
								<span class="font-medium">Counterparties: {results.counterparties.length}</span>
								{#if results.counterparties.filter(cp => !cp.existed).length > 0}
									<span class="text-xs text-success-400">{results.counterparties.filter(cp => !cp.existed).length} new</span>
								{/if}
								{#if results.counterparties.filter(cp => cp.existed).length > 0}
									<span class="text-xs text-warning-400">{results.counterparties.filter(cp => cp.existed).length} existing</span>
								{/if}
							</div>
							{#if results.counterparties.length > 0}
								<button
									type="button"
									onclick={() => copyToClipboard('counterparties', formatCounterparties())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy counterparties"
								>
									{#if copiedSection === 'counterparties'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							{/if}
						</div>
						{#if results.counterparties.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each results.counterparties as cp}
									<li class="flex items-center gap-1">
										{#if cp.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<a
											href={getCounterpartyUrl(cp)}
											target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<span>{cp.name}</span>
											<ExternalLink class="size-3" />
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<!-- Customers -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<UserCheck class="size-4 text-secondary-500" />
								<span class="font-medium">Customers: {results.customers.length}</span>
								{#if results.customers.filter(c => !c.existed).length > 0}
									<span class="text-xs text-success-400">{results.customers.filter(c => !c.existed).length} new</span>
								{/if}
								{#if results.customers.filter(c => c.existed).length > 0}
									<span class="text-xs text-warning-400">{results.customers.filter(c => c.existed).length} existing</span>
								{/if}
							</div>
							{#if results.customers.length > 0}
								<button
									type="button"
									onclick={() => copyToClipboard('customers', formatCustomers())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy customers"
								>
									{#if copiedSection === 'customers'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							{/if}
						</div>
						{#if results.customers.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each results.customers as cust}
									<li class="flex items-center gap-1">
										{#if cust.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										{#if cust.customer_type === 'CORPORATE'}
											<Building2 class="size-3 text-tertiary-400" />
										{:else}
											<UserCheck class="size-3 text-tertiary-400" />
										{/if}
										<a
											href={getCustomersUrl(cust.customer_type === 'CORPORATE' ? 'corporate' : 'individual')}
											target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<span>{cust.legal_name}</span>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-xs px-1 rounded {cust.customer_type === 'CORPORATE' ? 'bg-tertiary-700' : 'bg-secondary-700'}">{cust.customer_type}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<!-- FX Rates -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<TrendingUp class="size-4 text-secondary-500" />
								<span class="font-medium">FX Rates: {results.fxRates.length}</span>
								{#if results.fxRates.filter(fx => !fx.existed).length > 0}
									<span class="text-xs text-success-400">{results.fxRates.filter(fx => !fx.existed).length} new</span>
								{/if}
								{#if results.fxRates.filter(fx => fx.existed).length > 0}
									<span class="text-xs text-warning-400">{results.fxRates.filter(fx => fx.existed).length} existing</span>
								{/if}
							</div>
							{#if results.fxRates.length > 0}
								<button
									type="button"
									onclick={() => copyToClipboard('fxRates', formatFxRates())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy FX rates"
								>
									{#if copiedSection === 'fxRates'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							{/if}
						</div>
						{#if results.fxRates.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each results.fxRates.slice(0, 10) as fx}
									<li class="flex items-center gap-1">
										{#if fx.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<span>{fx.from_currency} → {fx.to_currency}:</span>
										<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{fx.rate}</code>
									</li>
								{/each}
								{#if results.fxRates.length > 10}
									<li class="text-surface-500">...and {results.fxRates.length - 10} more</li>
								{/if}
							</ul>
						{/if}
					</div>

					<!-- Transactions -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<History class="size-4 text-secondary-500" />
								<span class="font-medium">Transactions: {results.transactions.length}</span>
								{#if results.transactions.filter(t => !t.existed).length > 0}
									<span class="text-xs text-success-400">{results.transactions.filter(t => !t.existed).length} new</span>
								{/if}
								{#if results.transactions.filter(t => t.existed).length > 0}
									<span class="text-xs text-warning-400">{results.transactions.filter(t => t.existed).length} existing</span>
								{/if}
							</div>
							{#if results.transactions.length > 0}
								<button
									type="button"
									onclick={() => copyToClipboard('transactions', formatTransactions())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy transactions"
								>
									{#if copiedSection === 'transactions'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							{/if}
						</div>
						{#if results.transactions.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each results.transactions as txn}
									<li class="flex items-center gap-1">
										{#if txn.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<a
											href={getTransactionUrl(txn)}
											target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{txn.transaction_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-tertiary-400">{txn.amount}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<!-- Users -->
					{#if results.users && results.users.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<Users class="size-4 text-secondary-500" />
									<span class="font-medium">Users: {results.users.length}</span>
									{#if results.users.filter(u => !u.existed).length > 0}
										<span class="text-xs text-success-400">{results.users.filter(u => !u.existed).length} new</span>
									{/if}
									{#if results.users.filter(u => u.existed).length > 0}
										<span class="text-xs text-warning-400">{results.users.filter(u => u.existed).length} existing</span>
									{/if}
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('users', formatUsers())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy users"
								>
									{#if copiedSection === 'users'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each results.users as usr}
									<li class="flex items-center gap-1">
										{#if usr.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{usr.username}</code>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-surface-300">{usr.email}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- User-Customer Links -->
					{#if results.userCustomerLinks && results.userCustomerLinks.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<UserCheck class="size-4 text-secondary-500" />
									<span class="font-medium">User-Customer Links: {results.userCustomerLinks.length}</span>
									{#if results.userCustomerLinks.filter(l => !l.existed).length > 0}
										<span class="text-xs text-success-400">{results.userCustomerLinks.filter(l => !l.existed).length} new</span>
									{/if}
									{#if results.userCustomerLinks.filter(l => l.existed).length > 0}
										<span class="text-xs text-warning-400">{results.userCustomerLinks.filter(l => l.existed).length} existing</span>
									{/if}
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('userCustomerLinks', formatUserCustomerLinks())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy user-customer links"
								>
									{#if copiedSection === 'userCustomerLinks'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each results.userCustomerLinks as link}
									<li class="flex items-center gap-1">
										{#if link.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{link.username}</code>
										<span class="text-surface-400 mx-1">→</span>
										<span class="text-surface-300">{link.legal_name}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Customer Links -->
					{#if results.customerLinks && results.customerLinks.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<Link class="size-4 text-secondary-500" />
									<span class="font-medium">Customer Links: {results.customerLinks.length}</span>
									{#if results.customerLinks.filter(l => !l.existed).length > 0}
										<span class="text-xs text-success-400">{results.customerLinks.filter(l => !l.existed).length} new</span>
									{/if}
									{#if results.customerLinks.filter(l => l.existed).length > 0}
										<span class="text-xs text-warning-400">{results.customerLinks.filter(l => l.existed).length} existing</span>
									{/if}
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('customerLinks', formatCustomerLinks())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy customer links"
								>
									{#if copiedSection === 'customerLinks'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each results.customerLinks as link}
									<li class="flex items-center gap-1">
										{#if link.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<span class="text-surface-300">{link.customer_name}</span>
										<span class="text-surface-400 mx-1">→</span>
										<span class="text-surface-300">{link.other_customer_name}</span>
										<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded ml-1">{link.relationship_to}</code>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Errors -->
					{#if results.errors && results.errors.length > 0}
						<div class="p-3 rounded-lg bg-error-900/30 border border-error-700">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<XCircle class="size-4 text-error-500" />
									<span class="font-medium text-error-400"
										>Errors: {results.errors.length}</span
									>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('errors', formatErrors())}
									class="btn btn-sm preset-tonal-error flex items-center gap-1"
									title="Copy all errors to clipboard"
								>
									{#if copiedSection === 'errors'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-error-300 ml-6 space-y-1 max-h-32 overflow-y-auto">
								{#each results.errors.slice(0, 5) as error}
									<li class="truncate">{error}</li>
								{/each}
								{#if results.errors.length > 5}
									<li class="text-error-400">...and {results.errors.length - 5} more</li>
								{/if}
							</ul>
						</div>
					{/if}
				</div>
			{:else if form?.error}
				<div class="p-4 rounded-lg bg-error-900/30 border border-error-700">
					<p class="text-error-400">{form.error}</p>
				</div>
			{:else if hasExistingData()}
				<div class="space-y-4 max-h-[60vh] overflow-y-auto">
					<p class="text-sm text-surface-400 mb-4">Showing existing data for prefix <code class="bg-surface-700 px-1 rounded">{data.defaults.bankIdPrefix}</code></p>

					<!-- Existing Banks -->
					{#if data.existing.banks.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<Building class="size-4 text-secondary-500" />
									<span class="font-medium">Banks: {data.existing.banks.length}</span>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('existingBanks', formatExistingBanks())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy banks"
								>
									{#if copiedSection === 'existingBanks'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1">
								{#each data.existing.banks as bank}
									<li class="flex items-center gap-1">
										<a
											href={getBankUrl(bank)}
											target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{bank.bank_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-surface-300">{bank.full_name}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Existing Accounts -->
					{#if data.existing.accounts.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<Wallet class="size-4 text-secondary-500" />
									<span class="font-medium">Accounts: {data.existing.accounts.length}</span>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('existingAccounts', formatExistingAccounts())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy accounts"
								>
									{#if copiedSection === 'existingAccounts'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each data.existing.accounts as account}
									<li class="flex items-center gap-1">
										<a
											href={getAccountUrl(account)}
											target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{account.account_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-surface-300">{account.label}</span>
										{#if account.currency}
											<span class="text-surface-500 mx-1">|</span>
											<span class="text-tertiary-400">{account.currency}</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Existing Counterparties -->
					{#if data.existing.counterparties.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<Users class="size-4 text-secondary-500" />
									<span class="font-medium">Counterparties: {data.existing.counterparties.length}</span>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('existingCounterparties', formatExistingCounterparties())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy counterparties"
								>
									{#if copiedSection === 'existingCounterparties'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each data.existing.counterparties as cp}
									<li class="flex items-center gap-1">
										<a
											href={getCounterpartyUrl(cp)}
											target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<span>{cp.name}</span>
											<ExternalLink class="size-3" />
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Existing Customers -->
					{#if data.existing.customers.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<UserCheck class="size-4 text-secondary-500" />
									<span class="font-medium">Customers: {data.existing.customers.length}</span>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('existingCustomers', formatExistingCustomers())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy customers"
								>
									{#if copiedSection === 'existingCustomers'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each data.existing.customers as cust}
									<li class="flex items-center gap-1">
										{#if cust.customer_type === 'CORPORATE'}
											<Building2 class="size-3 text-tertiary-400" />
										{:else}
											<UserCheck class="size-3 text-tertiary-400" />
										{/if}
										<a
											href={getCustomersUrl(cust.customer_type === 'CORPORATE' ? 'corporate' : 'individual')}
											target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<span>{cust.legal_name}</span>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-xs px-1 rounded {cust.customer_type === 'CORPORATE' ? 'bg-tertiary-700' : 'bg-secondary-700'}">{cust.customer_type}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Existing FX Rates -->
					{#if data.existing.fxRates.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<TrendingUp class="size-4 text-secondary-500" />
									<span class="font-medium">FX Rates: {data.existing.fxRates.length}</span>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('existingFxRates', formatExistingFxRates())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy FX rates"
								>
									{#if copiedSection === 'existingFxRates'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each data.existing.fxRates.slice(0, 10) as fx}
									<li>{fx.from_currency} → {fx.to_currency}: <code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{fx.rate}</code></li>
								{/each}
								{#if data.existing.fxRates.length > 10}
									<li class="text-surface-500">...and {data.existing.fxRates.length - 10} more</li>
								{/if}
							</ul>
						</div>
					{/if}

					<!-- Existing Transactions -->
					{#if data.existing.transactions.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<History class="size-4 text-secondary-500" />
									<span class="font-medium">Transactions: {data.existing.transactions.length}</span>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('existingTransactions', formatExistingTransactions())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy transactions"
								>
									{#if copiedSection === 'existingTransactions'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each data.existing.transactions as txn}
									<li class="flex items-center gap-1">
										<a
											href={getTransactionUrl(txn)}
											target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 text-surface-100 px-1 rounded">{txn.transaction_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-tertiary-400">{txn.amount}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center py-12 text-surface-500">
					<Database class="size-12 mb-4 opacity-50" />
					<p>No existing data for prefix <code class="bg-surface-700 px-1 rounded">{data.defaults.bankIdPrefix}</code></p>
					<p class="text-sm mt-2">Configure options and click "Populate Sandbox"</p>
				</div>
			{/if}
		</div>
	</div>
</div>
