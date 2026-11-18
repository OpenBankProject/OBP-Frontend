<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import { describeDefinition, parseTestDefinition } from '@obp/shared/conformator';

	/** A suite's tests, in suite order: what each checks, the requirements it covers, and what it actually does. */
	let { tests }: { tests: Array<Record<string, any>> } = $props();

	const kinds: Record<string, string> = { automated: 'Automated', evidence: 'Evidence review', control: 'Organisational control' };

	/** The steps of an automated test in plain words, or why they cannot be shown. */
	function steps(test: Record<string, any>): { lines: string[]; problem: string | null } {
		const text = typeof test.definition === 'string' ? test.definition.trim() : '';
		if (!text) return { lines: [], problem: 'This test has no steps yet.' };
		const parsed = parseTestDefinition(text);
		return parsed.ok ? { lines: describeDefinition(parsed.definition), problem: null } : { lines: [], problem: 'Its steps have problems, so it cannot run yet.' };
	}
</script>

{#if tests.length === 0}
	<p class="mt-6">This suite has no tests yet.</p>
{:else}
	<details class="mt-6 max-w-3xl text-sm">
		<summary class="cursor-pointer font-semibold">How a test runs</summary>
		<p class="mt-2">
			A participant starts a run of this suite against one of their non-production systems. The runner then carries out each automated test's steps in
			order, calling the system's APIs the way a third-party provider would: over mutual TLS with its own certificate, as its own client of the system
			or on behalf of a test customer. A value kept from one answer (such as a consent's id) is used in later steps. The test passes when every
			answer is as expected; the result says exactly which expectation was not met.
		</p>
		<p class="mt-2">
			Evidence and control tests are not run by the runner. The participant gives evidence, and one of the regulator's reviewers decides.
		</p>
	</details>

	<ol class="mt-4 flex flex-col gap-3" data-testid="test-list">
		{#each tests as test (test.conformator_test_id)}
			{@const s = test.kind === 'automated' ? steps(test) : null}
			<li class="rounded border border-surface-500/30 p-4" data-testid="test-{test.test_id}">
				<div class="flex flex-wrap items-center gap-2">
					<code>{test.test_id}</code>
					<span class="font-semibold">{test.title}</span>
					{#if test.mandatory}<Badge value="mandatory" tone="primary" />{/if}
					<span class="text-sm opacity-80">{kinds[test.kind] ?? test.kind}, {test.severity} severity</span>
				</div>
				{#if test.expected_result}<p class="mt-1 text-sm"><span class="font-semibold">Passes when:</span> {test.expected_result}</p>{/if}
				{#if test.requirements?.length}
					<p class="mt-1 text-sm">
						<span class="font-semibold">Requirements:</span>
						{#each test.requirements as req, i (req.id)}{i ? '; ' : ''}<code>{req.reference}</code> {req.title}{/each}
					</p>
				{/if}
				<details class="mt-2 text-sm">
					<summary class="cursor-pointer">What it does</summary>
					{#if s}
						{#if s.problem}
							<p class="mt-2">{s.problem}</p>
						{:else}
							<ol class="mt-2 list-inside list-decimal space-y-1">
								{#each s.lines as line, i (i)}<li>{line}</li>{/each}
							</ol>
						{/if}
					{:else}
						<p class="mt-2">A person decides this test. The participant gives: {test.evidence_required || 'the evidence the regulator asks for'}. A reviewer then assesses it as passed, failed or not applicable.</p>
					{/if}
					{#if test.suggested_fix}<p class="mt-2"><span class="font-semibold">If it fails:</span> {test.suggested_fix}</p>{/if}
				</details>
			</li>
		{/each}
	</ol>
{/if}
