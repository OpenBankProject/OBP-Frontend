<script lang="ts">
	import { Portal, Switch, Tooltip } from '@skeletonlabs/skeleton-svelte';
	import { onMount } from 'svelte';

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
		const storedMode = localStorage.getItem('mode') || 'dark';
		mode = storedMode as 'dark' | 'light';
		document.documentElement.setAttribute('data-mode', mode);
	});

	const onCheckedChange = (details: { checked: boolean }) => {
		mode = details.checked ? 'dark' : 'light';
		document.documentElement.setAttribute('data-mode', mode);
		localStorage.setItem('mode', mode);
	};
</script>

<svelte:head>
	<script>
		var mode = localStorage.getItem('mode') || 'dark';
		document.documentElement.setAttribute('data-mode', mode);
	</script>
</svelte:head>

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
