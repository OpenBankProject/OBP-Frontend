<script lang="ts">
	interface BankLike {
		bank_id: string;
		bank_code?: string;
		short_name?: string;
		full_name?: string;
	}

	/**
	 * The subset of a `currentBank` store this picker needs. Both the api-manager and
	 * Portal `currentBank` stores satisfy this shape, so the component is app-agnostic.
	 */
	interface CurrentBankStoreLike {
		bank: BankLike | null;
		banks: BankLike[];
		bankId: string;
		justChanged?: boolean;
		selectById(bankId: string): void;
		fetchBanks(): unknown;
	}

	interface Props {
		store: CurrentBankStoreLike;
	}

	let { store }: Props = $props();

	let open = $state(false);

	async function openPicker() {
		try {
			await store.fetchBanks();
		} catch {
			// The select still renders; an empty list just shows the placeholder option.
		}
		open = true;
	}

	// Pop the native option list as soon as the <select> appears, matching the
	// "click pencil → dropdown is already open" feel of the api-manager header.
	function autoShowPicker(node: HTMLSelectElement) {
		try {
			node.showPicker();
		} catch {
			// showPicker() isn't supported everywhere — harmless to skip.
		}
	}
</script>

{#if open}
	<span class="inline-flex items-center gap-2" data-testid="current-bank-picker-open">
		<select
			use:autoShowPicker
			class="rounded-md border border-surface-300-700 bg-surface-100-900 px-2 py-1 text-sm"
			value={store.bankId}
			onchange={(e) => {
				store.selectById(e.currentTarget.value);
				open = false;
			}}
			data-testid="current-bank-select"
		>
			<option value="">-- Select a bank --</option>
			{#each store.banks as bank (bank.bank_id)}
				<option value={bank.bank_id}>
					{bank.bank_id} — {bank.bank_code} — {bank.full_name}
				</option>
			{/each}
		</select>
		<button
			type="button"
			class="text-sm opacity-60 hover:opacity-100"
			onclick={() => (open = false)}
			title="Close"
		>&times;</button>
	</span>
{:else if store.bank}
	<span class="text-sm" class:bank-changed={store.justChanged} data-testid="current-bank-picker">
		{store.bank.full_name}: {store.bank.bank_id} ({store.bank.bank_code})
		<button
			type="button"
			class="hover:text-tertiary-400"
			onclick={openPicker}
			title="Change current bank"
			aria-label="Change current bank"
		>&#9998;</button>
	</span>
{:else}
	<button
		type="button"
		class="text-sm opacity-70 hover:text-tertiary-400 hover:opacity-100"
		onclick={openPicker}
		data-testid="current-bank-picker"
	>Select Bank &#9998;</button>
{/if}

<style>
	@keyframes bank-highlight {
		0% {
			color: #22c55e;
		}
		25% {
			color: #3b82f6;
		}
		50% {
			color: #a855f7;
		}
		75% {
			color: #f59e0b;
		}
		100% {
			color: inherit;
		}
	}

	.bank-changed {
		animation: bank-highlight 1.5s ease-in-out;
		font-weight: 700;
	}
</style>
