<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import {
		Upload,
		Loader2,
		CheckCircle,
		XCircle,
		FileSpreadsheet,
		Download,
		Building,
		Wallet,
		Users,
		TrendingUp
	} from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let isLoading = $state(false);

	// CSV text content (read from uploaded files client-side)
	let banksCsv = $state('');
	let accountsCsv = $state('');
	let customersCsv = $state('');
	let transactionsCsv = $state('');

	// Preview row counts
	let banksCount = $derived(countCsvRows(banksCsv));
	let accountsCount = $derived(countCsvRows(accountsCsv));
	let customersCount = $derived(countCsvRows(customersCsv));
	let transactionsCount = $derived(countCsvRows(transactionsCsv));

	function countCsvRows(csv: string): number {
		if (!csv.trim()) return 0;
		const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
		return Math.max(0, lines.length - 1); // minus header
	}

	function handleFileUpload(event: Event, setter: (value: string) => void) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			setter(e.target?.result as string);
		};
		reader.readAsText(file);
	}

	function hasAnyCsv(): boolean {
		return !!(
			banksCsv.trim() ||
			accountsCsv.trim() ||
			customersCsv.trim() ||
			transactionsCsv.trim()
		);
	}

	// Template CSV content for download
	const templates: Record<string, { filename: string; content: string }> = {
		banks: {
			filename: 'banks_template.csv',
			content: `full_name,bank_code
First National Bank,FNB.
Community Savings Bank,CSB.`
		},
		accounts: {
			filename: 'accounts_template.csv',
			content: `bank_code,number,currency,legal_name
FNB.,10010001,USD,Jane Smith
FNB.,10010002,USD,Jane Smith
CSB.,20010001,EUR,Acme Corp`
		},
		customers: {
			filename: 'customers_template.csv',
			content: `legal_name,customer_type,mobile_phone_number,email,date_of_birth,title,employment_status,highest_education_attained,relationship_status,category,bank_code
Jane Smith,individual,+1 555 0101,jane@example.com,1985-03-15,Ms,employed,Bachelor,single,,FNB.
John Doe,individual,+1 555 0102,john@example.com,1978-11-22,Mr,employed,Master,married,,FNB.
Acme Corp,corporate,+1 555 0200,info@acme.example.com,,,,,,,CSB.`
		},
		transactions: {
			filename: 'transactions_template.csv',
			content: `date,from_account_number,from_bank_code,to_account_number,to_bank_code,amount,currency,description
2024-06-15,10010001,FNB.,10010002,FNB.,500.00,USD,Monthly savings transfer
2024-06-16,10010001,FNB.,10010002,FNB.,250.00,USD,Expense reimbursement`
		}
	};

	// Example data — a complete, realistic set you can import right away
	const exampleData = {
		banks: `full_name,bank_code
Greenfield Community Bank,GCB.
Riverside Savings & Loans,RSL.`,
		accounts: `bank_code,number,currency,legal_name
GCB.,GCB-0001,USD,Maria Garcia
GCB.,GCB-0002,USD,Maria Garcia
GCB.,GCB-0003,USD,James Chen
GCB.,GCB-0004,USD,Sunrise Bakery Ltd
RSL.,RSL-0001,EUR,James Chen
RSL.,RSL-0002,EUR,Sunrise Bakery Ltd`,
		customers: `legal_name,customer_type,mobile_phone_number,email,date_of_birth,title,employment_status,highest_education_attained,relationship_status,category,bank_code
Maria Garcia,individual,+1 555 0101,maria.garcia@example.com,1985-03-15,Ms,employed,Bachelor,married,,GCB.
James Chen,individual,+1 555 0102,james.chen@example.com,1978-11-22,Mr,self-employed,Master,single,,GCB.
Priya Patel,individual,+1 555 0103,priya.patel@example.com,1992-07-08,Dr,employed,Doctorate,married,,GCB.
Sunrise Bakery Ltd,corporate,+1 555 0200,info@sunrisebakery.example.com,,,,,,Food & Beverage,GCB.
James Chen,individual,+44 20 7946 0102,james.chen@example.com,1978-11-22,Mr,self-employed,Master,single,,RSL.
Sunrise Bakery Ltd,corporate,+44 20 7946 0200,info@sunrisebakery.example.com,,,,,,Food & Beverage,RSL.`,
		transactions: `date,from_account_number,from_bank_code,to_account_number,to_bank_code,amount,currency,description
2024-06-01,GCB-0001,GCB.,GCB-0002,GCB.,12500.00,USD,June payroll funding
2024-06-05,GCB-0001,GCB.,GCB-0003,GCB.,3200.00,USD,Quarterly tax provision
2024-06-10,GCB-0001,GCB.,GCB-0004,GCB.,2000.00,USD,Q3 marketing budget
2024-06-15,GCB-0002,GCB.,GCB-0001,GCB.,850.00,USD,Payroll correction refund
2024-06-20,RSL-0001,RSL.,RSL-0002,RSL.,5000.00,EUR,Investment transfer`
	};

	function downloadCsv(filename: string, content: string) {
		const blob = new Blob([content], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function downloadTemplate(key: string) {
		const template = templates[key];
		downloadCsv(template.filename, template.content);
	}

	function downloadExample(key: string) {
		const content = exampleData[key as keyof typeof exampleData];
		if (content) {
			downloadCsv(`example_${key}.csv`, content);
		}
	}
</script>

<div class="p-8 w-full">
	<h1 class="h1 mb-2">Import from CSV</h1>
	<p class="text-surface-400 mb-2">
		Upload CSV files to populate your OBP sandbox as <span class="text-secondary-400"
			>{data.username}</span
		>
	</p>
	<p class="text-surface-500 text-sm mb-8">
		CSV column names match OBP API field names.
		Download templates or examples below for each data type.
	</p>

	<form
		method="POST"
		action="?/import"
		use:enhance={() => {
			isLoading = true;
			return async ({ update }) => {
				await update();
				isLoading = false;
			};
		}}
	>
		<!-- Hidden fields with CSV content -->
		<input type="hidden" name="banks_csv" value={banksCsv} />
		<input type="hidden" name="accounts_csv" value={accountsCsv} />
		<input type="hidden" name="customers_csv" value={customersCsv} />
		<input type="hidden" name="transactions_csv" value={transactionsCsv} />

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
			<!-- Left column: Upload -->
			<div class="space-y-4">
				<!-- Banks CSV -->
				{@render csvUploadSection(
					'banks',
					'Banks',
					Building,
					banksCount,
					'full_name, bank_code',
					(v) => (banksCsv = v)
				)}

				<!-- Accounts CSV -->
				{@render csvUploadSection(
					'accounts',
					'Accounts',
					Wallet,
					accountsCount,
					'bank_code, number, currency, legal_name',
					(v) => (accountsCsv = v)
				)}

				<!-- Customers CSV -->
				{@render csvUploadSection(
					'customers',
					'Customers',
					Users,
					customersCount,
					'legal_name, customer_type, mobile_phone_number, email, date_of_birth, title, bank_code',
					(v) => (customersCsv = v)
				)}

				<!-- Transactions CSV -->
				{@render csvUploadSection(
					'transactions',
					'Transactions',
					TrendingUp,
					transactionsCount,
					'date, from_account_number, from_bank_code, to_account_number, to_bank_code, amount, currency',
					(v) => (transactionsCsv = v)
				)}

				<!-- Submit -->
				<button
					type="submit"
					class="btn preset-filled-primary-500 w-full"
					disabled={isLoading || !hasAnyCsv()}
				>
					{#if isLoading}
						<Loader2 class="size-4 animate-spin" />
						Importing...
					{:else}
						<Upload class="size-4" />
						Import CSV Data
					{/if}
				</button>
			</div>

			<!-- Right column: Results -->
			<div class="space-y-4">
				{#if form?.results}
					<div class="card p-6 preset-filled-surface-50-950">
						<h2 class="h3 mb-4 flex items-center gap-2">
							<CheckCircle class="size-5 text-success-500" />
							Import Results
						</h2>

						{#if form.results.banks.length > 0}
							{@render resultSection('Banks', form.results.banks, (b) => `${b.name} (${b.bank_id}) - ${b.status}`)}
						{/if}

						{#if form.results.accounts.length > 0}
							{@render resultSection('Accounts', form.results.accounts, (a) => `${a.number} at ${a.bank_code} - ${a.status}`)}
						{/if}

						{#if form.results.customers.length > 0}
							{@render resultSection('Customers', form.results.customers, (c) => `${c.legal_name} (${c.customer_type}) - ${c.status}`)}
						{/if}

						{#if form.results.customerAccountLinks.length > 0}
							{@render resultSection('Customer-Account Links', form.results.customerAccountLinks, (l) => `${l.legal_name} -> ${l.number} - ${l.status}`)}
						{/if}

						{#if form.results.transactions.length > 0}
							{@render resultSection('Transactions', form.results.transactions, (t) => `${t.from} -> ${t.to}: ${t.amount} - ${t.status}`)}
						{/if}

					</div>

					{#if form.results.errors.length > 0}
						<div class="card p-6 preset-filled-surface-50-950 border border-error-500/30">
							<h3 class="h4 mb-3 flex items-center gap-2 text-error-400">
								<XCircle class="size-5" />
								Errors ({form.results.errors.length})
							</h3>
							<ul class="space-y-1 text-sm">
								{#each form.results.errors as error}
									<li class="text-error-300">{error}</li>
								{/each}
							</ul>
						</div>
					{/if}
				{:else}
					<div class="card p-6 preset-filled-surface-50-950">
						<h2 class="h3 mb-4 flex items-center gap-2">
							<FileSpreadsheet class="size-5 text-secondary-500" />
							How it works
						</h2>
						<ol class="space-y-3 text-sm text-surface-300">
							<li>
								<strong class="text-surface-50">1. Download templates or examples</strong> - Each
								section has a Template (empty with column headers) and an Example (with realistic
								data you can import right away to test the process).
							</li>
							<li>
								<strong class="text-surface-50">2. Fill in your data</strong> - Use plain
								business names. For example, give each bank a short code (like "FNB") and
								reference that code in the other CSV files.
							</li>
							<li>
								<strong class="text-surface-50">3. Upload CSVs</strong> - Upload one or more
								CSV files. You don't need all of them — just upload what you have.
							</li>
							<li>
								<strong class="text-surface-50">4. Import</strong> - The app processes files in
								dependency order: Banks, Accounts, Customers, Transactions. Customer-account
								links are created automatically.
							</li>
						</ol>

						<h3 class="h4 mt-6 mb-3">How files link together</h3>
						<ul class="space-y-3 text-sm text-surface-300">
							<li>
								<strong class="text-surface-50">Banks → Accounts:</strong>
								The <code class="bg-surface-700 px-1 rounded">bank_code</code> column in accounts.csv
								must match a <code class="bg-surface-700 px-1 rounded">bank_code</code> from banks.csv.
								This tells the app which bank the account belongs to.
							</li>
							<li>
								<strong class="text-surface-50">Banks → Customers:</strong>
								The <code class="bg-surface-700 px-1 rounded">bank_code</code> column in customers.csv
								must match a <code class="bg-surface-700 px-1 rounded">bank_code</code> from banks.csv.
								Each customer is created at the specified bank.
							</li>
							<li>
								<strong class="text-surface-50">Customers → Accounts (automatic linking):</strong>
								The <code class="bg-surface-700 px-1 rounded">legal_name</code> column in accounts.csv
								must match a <code class="bg-surface-700 px-1 rounded">legal_name</code> from customers.csv
								at the same bank. When both match, the app automatically creates a Customer Account Link
								with relationship_type "Owner" — no extra file needed.
							</li>
							<li>
								<strong class="text-surface-50">Accounts → Transactions:</strong>
								The <code class="bg-surface-700 px-1 rounded">from_account_number</code> and
								<code class="bg-surface-700 px-1 rounded">to_account_number</code> columns in transactions.csv
								must match <code class="bg-surface-700 px-1 rounded">number</code> values from
								accounts.csv. The <code class="bg-surface-700 px-1 rounded">from_bank_code</code> and
								<code class="bg-surface-700 px-1 rounded">to_bank_code</code> columns must match
								<code class="bg-surface-700 px-1 rounded">bank_code</code> values from banks.csv.
								Both accounts must be at the same bank.
							</li>
						</ul>
					</div>
				{/if}
			</div>
		</div>
	</form>
</div>

{#snippet csvUploadSection(key: string, label: string, Icon: any, rowCount: number, columns: string, setter: (v: string) => void)}
	<div class="card p-4 preset-filled-surface-50-950">
		<div class="flex items-center justify-between mb-2">
			<h3 class="text-sm font-medium flex items-center gap-2">
				<Icon class="size-4 text-secondary-500" />
				{label}
				{#if rowCount > 0}
					<span class="badge preset-filled-secondary-500 text-xs">{rowCount} rows</span>
				{/if}
			</h3>
			<div class="flex gap-2">
				<button
					type="button"
					class="btn btn-sm preset-outlined-surface-50-950"
					onclick={() => downloadTemplate(key)}
				>
					<Download class="size-3" />
					Template
				</button>
				<button
					type="button"
					class="btn btn-sm preset-filled-secondary-500"
					onclick={() => downloadExample(key)}
				>
					<Download class="size-3" />
					Example
				</button>
			</div>
		</div>
		<p class="text-xs text-surface-500 mb-2">Columns: {columns}</p>
		<input
			type="file"
			accept=".csv,text/csv"
			class="input w-full text-sm"
			disabled={isLoading}
			onchange={(e) => handleFileUpload(e, setter)}
		/>
	</div>
{/snippet}

{#snippet resultSection(title: string, items: any[], formatter: (item: any) => string)}
	<div class="mb-4">
		<h3 class="text-sm font-medium mb-2">
			{title}
			<span class="badge preset-filled-success-500 text-xs ml-1">{items.length}</span>
		</h3>
		<ul class="space-y-1 text-xs text-surface-300">
			{#each items as item}
				<li class="flex items-center gap-1">
					{#if item.status === 'created'}
						<CheckCircle class="size-3 text-success-500 flex-shrink-0" />
					{:else}
						<CheckCircle class="size-3 text-warning-500 flex-shrink-0" />
					{/if}
					{formatter(item)}
				</li>
			{/each}
		</ul>
	</div>
{/snippet}
