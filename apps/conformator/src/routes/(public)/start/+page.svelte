<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { Check } from '@lucide/svelte';

	let { data } = $props();

	const next = $derived(data.steps.find((s) => s.status === 'next') ?? null);
	const doneCount = $derived(data.steps.filter((s) => s.status === 'done').length);
	const tracks = [
		{ key: 'admin', label: 'For the administrator' },
		{ key: 'regulator', label: 'For the regulator’s staff' },
		{ key: 'participant', label: 'For participants' }
	] as const;
</script>

<svelte:head><title>Getting started · Conformator</title></svelte:head>

<h1 class="h2">Getting started</h1>
<p class="mt-2 max-w-3xl">
	Conformator tests open banking systems against the regulator's rules, and turns the results into signed conformance reports. These are the steps,
	in order. {data.loggedIn ? 'Each step shows how far you have got.' : 'Log in to see how far you have got.'}
</p>

<nav class="mt-6 flex flex-wrap gap-2" aria-label="Whose steps to show">
	{#each tracks as t (t.key)}
		<a
			href="/start?for={t.key}"
			class="btn {data.track === t.key ? 'preset-filled' : 'preset-tonal'}"
			aria-current={data.track === t.key ? 'page' : undefined}
			data-testid="start-track-{t.key}">{t.label}</a
		>
	{/each}
</nav>

<p class="mt-4 max-w-3xl text-sm" data-testid="start-track-intro">
	{#if data.track === 'admin'}
		Done once, by an OBP-API administrator, before anyone else can use Conformator. The <a class="anchor" href="/setup">setup page</a> shows every piece in detail.
	{:else if data.track === 'regulator'}
		For the regulator's staff, who keep the catalogue, admit participants, review their results and issue reports.
	{:else}
		For banks, payment service providers and third-party providers testing their systems.
	{/if}
</p>

<!-- The steps at a glance: done, next and still to do. -->
<ol class="mt-8 flex max-w-4xl flex-wrap items-center gap-y-3" aria-label="Progress" data-testid="start-stepper">
	{#each data.steps as step, i (step.key)}
		<li class="flex items-center">
			<a href="#step-{step.key}" class="flex items-center gap-2" title={step.title}>
				<span
					class="flex size-9 shrink-0 items-center justify-center rounded-full border-2 font-bold
						{step.status === 'done' ? 'border-success-500 bg-success-500 text-white' : step.status === 'next' ? 'border-primary-500 bg-primary-500 text-white ring-4 ring-primary-500/30' : 'border-surface-400-600'}"
				>
					{#if step.status === 'done'}<Check size={18} aria-label="done" />{:else}{i + 1}{/if}
				</span>
				<span class="hidden text-sm lg:inline {step.status === 'next' ? 'font-semibold' : ''}">{step.title}</span>
			</a>
			{#if i < data.steps.length - 1}<span class="mx-2 h-0.5 w-6 lg:w-8 {step.status === 'done' ? 'bg-success-500' : 'bg-surface-300-700'}" aria-hidden="true"></span>{/if}
		</li>
	{/each}
</ol>
<p class="mt-3 text-sm" data-testid="start-summary">
	{#if data.loggedIn}
		{doneCount} of {data.steps.length} steps done.{#if next}&nbsp;Next: <a class="anchor" href="#step-{next.key}">{next.title}</a>.{:else}&nbsp;You have done every step.{/if}
	{/if}
</p>

<ol class="mt-6 max-w-3xl space-y-4">
	{#each data.steps as step, i (step.key)}
		<li
			id="step-{step.key}"
			class="scroll-mt-4 rounded-lg border-2 p-5 {step.status === 'next' ? 'border-primary-500 preset-tonal-primary' : 'border-surface-200-800'}"
			data-testid="start-step-{step.key}"
			data-status={step.status}
		>
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="h4">{i + 1}. {step.title}</h2>
				{#if step.status === 'done'}
					<span class="badge preset-filled-success-500">Done</span>
				{:else if step.status === 'next'}
					<span class="badge preset-filled-primary-500">Next step</span>
				{/if}
			</div>
			<p class="mt-2">{step.what}</p>
			<p class="mt-2 text-sm"><strong>Who:</strong> {step.who}</p>
			{#if step.progress}<p class="mt-1 text-sm" data-testid="start-progress-{step.key}">{step.progress}</p>{/if}
			<div class="mt-3 flex flex-wrap items-center gap-3">
				<a class="btn {step.status === 'next' ? 'preset-filled' : 'preset-tonal'}" href={step.href}>{step.action}</a>
				{#if step.shortcut}<a class="anchor text-sm" href={step.shortcut.href}>{step.shortcut.label}</a>{/if}
			</div>
		</li>
	{/each}
</ol>

<p class="mt-8 max-w-3xl text-sm">
	How the parts fit together, from requirements to reports, is on the <a class="anchor" href="/#about">home page</a>.
</p>
