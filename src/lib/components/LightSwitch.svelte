<script lang="ts">
	import { Portal, Switch, Tooltip } from '@skeletonlabs/skeleton-svelte';
	import { onMount } from 'svelte';
	import { userPreferences } from '$lib/stores/userPreferences.svelte';

	// Icons
	import IconMoon from '@lucide/svelte/icons/moon';
	import IconSun from '@lucide/svelte/icons/sun';

	interface LightSwitchProps {
		mode?: 'dark' | 'light';
	}

	let { mode = $bindable('dark') }: LightSwitchProps = $props();

	let checked = $derived(mode === 'dark');
	let toolTipString = $derived(checked ? 'Toggle Light Mode' : 'Toggle Dark Mode');

	onMount(() => {
		// Read from preferences store (which reads from localStorage / OBP)
		mode = userPreferences.theme;
		document.documentElement.setAttribute('data-mode', mode);
	});

	const onCheckedChange = (details: { checked: boolean }) => {
		mode = details.checked ? 'dark' : 'light';
		document.documentElement.setAttribute('data-mode', mode);
		// Save via preferences store (syncs to localStorage + OBP)
		userPreferences.setTheme(mode);
	};
</script>

<Tooltip openDelay={100}>
	<Tooltip.Trigger>
		<Switch {checked} {onCheckedChange}>
			<Switch.Control>
				<Switch.Thumb>
					<Switch.Context>
						{#snippet children(switch_: any)}
							{#if switch_().checked}
								<IconSun size={14} />
							{:else}
								<IconMoon size={14} />
							{/if}
						{/snippet}
					</Switch.Context>
				</Switch.Thumb>
			</Switch.Control>
			<Switch.HiddenInput />
		</Switch>
	</Tooltip.Trigger>
	<Portal>
		<Tooltip.Positioner>
			<Tooltip.Content class="card preset-filled-surface-50-950 p-2 text-xs">
				{toolTipString}
			</Tooltip.Content>
		</Tooltip.Positioner>
	</Portal>
</Tooltip>
