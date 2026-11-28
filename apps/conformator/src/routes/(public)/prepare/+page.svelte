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
	import { RichMessage } from '@obp/shared/components';
	import { formatNumber, m } from '@obp/shared/i18n';

	let { data } = $props();

	const next = $derived(data.steps.find((s) => s.status === 'next') ?? null);
	const doneCount = $derived(data.steps.filter((s) => s.status === 'done').length);
	const tracks = [
		{ key: 'admin', label: m.conformator_prepare_track_admin() },
		{ key: 'regulator', label: m.conformator_prepare_track_regulator() },
		{ key: 'participant', label: m.conformator_prepare_track_participant() }
	] as const;
</script>

<svelte:head><title>{m.conformator_nav_prepare()} · Conformator</title></svelte:head>

<h1 class="h2">{m.conformator_nav_prepare()}</h1>
<p class="mt-2 max-w-3xl">
	{m.conformator_prepare_intro()} {data.loggedIn ? m.conformator_prepare_progress_shown() : m.conformator_prepare_log_in_for_progress()}
</p>

<nav class="mt-6 flex flex-wrap gap-2" aria-label={m.conformator_prepare_tracks()}>
	{#each tracks as t (t.key)}
		<a
			href="/prepare?for={t.key}"
			class="btn {data.track === t.key ? 'preset-filled-primary-500' : 'preset-tonal'}"
			aria-current={data.track === t.key ? 'page' : undefined}
			data-testid="start-track-{t.key}">{t.label}</a
		>
	{/each}
</nav>

<p class="mt-4 max-w-3xl text-sm" data-testid="start-track-intro">
	{#if data.track === 'admin'}
		<RichMessage parts={m.conformator_prepare_intro_admin.parts()} links={{ setup: '/setup' }} />
	{:else if data.track === 'regulator'}
		{m.conformator_prepare_intro_regulator()}
	{:else}
		{m.conformator_prepare_intro_participant()}
	{/if}
</p>

<!-- The steps at a glance: done, next and still to do. -->
<ol class="mt-8 flex max-w-4xl flex-wrap items-center gap-y-3" aria-label={m.conformator_prepare_progress()} data-testid="start-stepper">
	{#each data.steps as step, i (step.key)}
		<li class="flex items-center">
			<a href="#step-{step.key}" class="flex items-center gap-2" title={step.title}>
				<span
					class="flex size-9 shrink-0 items-center justify-center rounded-full border-2 font-bold
						{step.status === 'done' ? 'ui-tone-success' : step.status === 'next' ? 'preset-filled-primary-500 ui-border-brand' : 'ui-border'}"
				>
					{#if step.status === 'done'}<Check size={18} aria-label={m.conformator_prepare_done()} />{:else}{formatNumber(i + 1)}{/if}
				</span>
				<span class="hidden text-sm lg:inline {step.status === 'next' ? 'font-semibold' : ''}">{step.title}</span>
			</a>
			{#if i < data.steps.length - 1}<span class="mx-2 h-0.5 w-6 lg:w-8" style="background: var({step.status === 'done' ? '--ui-success' : '--ui-border'})" aria-hidden="true"></span>{/if}
		</li>
	{/each}
</ol>
<p class="mt-3 text-sm" data-testid="start-summary">
	{#if data.loggedIn}
		{m.conformator_prepare_steps_done({ done: formatNumber(doneCount), total: formatNumber(data.steps.length) })}{#if next}&nbsp;<RichMessage parts={m.conformator_prepare_next.parts({ title: next.title })} links={{ next: `#step-${next.key}` }} />{:else}&nbsp;{m.conformator_prepare_all_done()}{/if}
	{/if}
</p>

<ol class="mt-6 max-w-3xl space-y-4">
	{#each data.steps as step, i (step.key)}
		<li
			id="step-{step.key}"
			class="scroll-mt-4 rounded-lg border-2 p-5 {step.status === 'next' ? 'ui-tone-info' : 'ui-border'}"
			data-testid="start-step-{step.key}"
			data-status={step.status}
		>
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="h4 flex items-center gap-2">
					{#if step.status === 'done'}<span class="flex size-7 shrink-0 items-center justify-center rounded-full ui-tone-success"><Check size={16} aria-hidden="true" /></span>{/if}
					{formatNumber(i + 1)}. {step.title}
				</h2>
				{#if step.status === 'done'}
					<span class="badge ui-tone-success gap-1 text-base font-semibold" data-testid="start-done-{step.key}"><Check size={16} aria-hidden="true" />{m.conformator_prepare_done()}</span>
				{:else if step.status === 'next'}
					<span class="badge preset-filled-primary-500">{m.conformator_prepare_next_step()}</span>
				{/if}
			</div>
			<p class="mt-2">{step.what}</p>
			<p class="mt-2 text-sm"><strong>{m.conformator_prepare_who()}</strong> {step.who}</p>
			{#if step.progress}<p class="mt-1 text-sm" data-testid="start-progress-{step.key}">{step.progress}</p>{/if}
			<div class="mt-3 flex flex-wrap items-center gap-3">
				<a class="btn {step.status === 'next' ? 'preset-filled-primary-500' : 'preset-tonal'}" href={step.href}>{step.action}</a>
				{#if step.shortcut}<a class="anchor text-sm" href={step.shortcut.href}>{step.shortcut.label}</a>{/if}
			</div>
		</li>
	{/each}
</ol>

<p class="mt-8 max-w-3xl text-sm">
	<RichMessage parts={m.conformator_prepare_how_parts_fit.parts()} links={{ home: '/#about' }} />
</p>
