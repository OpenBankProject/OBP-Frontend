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

	const uid = $props.id();
	const listboxId = `${uid}-bank-listbox`;

	let open = $state(false);
	let query = $state('');
	let activeIndex = $state(0);

	// Type-to-find across every identifier a user is likely to know: id, code,
	// short and full name. Case-insensitive substring, so "psd" finds
	// "gh.29.uk-psd2", "PSD2-Bank" and "The PSD2 Test Bank" alike.
	const filteredBanks = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return store.banks;
		return store.banks.filter((bank) =>
			[bank.bank_id, bank.bank_code, bank.short_name, bank.full_name].some(
				(field) => !!field && field.toLowerCase().includes(q)
			)
		);
	});

	async function openPicker() {
		query = '';
		activeIndex = 0;
		try {
			await store.fetchBanks();
		} catch {
			// The picker still renders; an empty list just shows "no banks match".
		}
		open = true;
	}

	function choose(bank: BankLike) {
		store.selectById(bank.bank_id);
		open = false;
	}

	function onInput() {
		activeIndex = 0;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (activeIndex < filteredBanks.length - 1) activeIndex += 1;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (activeIndex > 0) activeIndex -= 1;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const bank = filteredBanks[activeIndex];
			if (bank) choose(bank);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
		}
	}

	function focusInput(node: HTMLInputElement) {
		node.focus();
	}

	function optionId(index: number): string {
		return `${listboxId}-option-${index}`;
	}

	function bankLabel(bank: BankLike): string {
		const code = bank.bank_code ? ` — ${bank.bank_code}` : '';
		const name = bank.full_name || bank.short_name || '';
		return `${bank.bank_id}${code}${name ? ` — ${name}` : ''}`;
	}
</script>

{#if open}
	<span class="relative inline-flex items-start gap-2" data-testid="current-bank-picker-open">
		<span class="inline-flex flex-col">
			<input
				use:focusInput
				type="text"
				role="combobox"
				aria-expanded="true"
				aria-controls={listboxId}
				aria-activedescendant={filteredBanks.length > 0 ? optionId(activeIndex) : undefined}
				aria-label="Find bank by id, code or name"
				placeholder="Type bank id, code or name"
				autocomplete="off"
				spellcheck="false"
				class="w-[28rem] max-w-[80vw] rounded-md border border-surface-300-700 bg-surface-100-900 px-2 py-1 text-sm"
				bind:value={query}
				oninput={onInput}
				onkeydown={onKeydown}
				data-testid="current-bank-search"
			/>
			<ul
				id={listboxId}
				role="listbox"
				aria-label="Banks"
				class="absolute top-full left-0 z-50 mt-1 max-h-72 w-[36rem] max-w-[90vw] overflow-y-auto rounded-md border border-surface-300-700 bg-surface-100-900 py-1 text-sm shadow-lg"
				data-testid="current-bank-options"
			>
				{#if filteredBanks.length === 0}
					<li class="px-3 py-1.5 opacity-70" data-testid="current-bank-no-match">
						No banks match "{query}"
					</li>
				{:else}
					{#each filteredBanks as bank, index (bank.bank_id)}
						<li
							id={optionId(index)}
							role="option"
							aria-selected={bank.bank_id === store.bankId}
							class="cursor-pointer px-3 py-1.5 {index === activeIndex
								? 'bg-primary-500/20'
								: 'hover:bg-surface-200-800'}"
							data-testid="current-bank-option-{bank.bank_id}"
							onpointerdown={(e) => {
								// pointerdown, not click: selecting must win the race against the
								// input's blur closing the picker.
								e.preventDefault();
								choose(bank);
							}}
							onpointermove={() => (activeIndex = index)}
						>
							{bankLabel(bank)}
						</li>
					{/each}
				{/if}
			</ul>
		</span>
		<button
			type="button"
			class="text-sm opacity-60 hover:opacity-100"
			onclick={() => (open = false)}
			aria-label="Close bank picker"
		>&times;</button>
	</span>
{:else if store.bank}
	<span class="text-sm" class:bank-changed={store.justChanged} data-testid="current-bank-picker">
		{store.bank.full_name}: {store.bank.bank_id} ({store.bank.bank_code})
		<button
			type="button"
			class="hover:text-tertiary-400"
			onclick={openPicker}
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
