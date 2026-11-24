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
	import { m } from '@obp/shared/i18n';
	import { valueLabel } from '$lib/valueLabel';

	/** A suite's tests, in suite order: what each checks, the requirements it covers, and what it actually does. */
	let { tests }: { tests: Array<Record<string, any>> } = $props();

	const kinds: Record<string, string> = { automated: m.conformator_test_kind_automated(), evidence: m.conformator_test_kind_evidence(), control: m.conformator_test_kind_control() };

	/** The steps of an automated test in plain words, or why they cannot be shown. */
	function steps(test: Record<string, any>): { lines: string[]; problem: string | null } {
		const text = typeof test.definition === 'string' ? test.definition.trim() : '';
		if (!text) return { lines: [], problem: m.conformator_tests_no_steps() };
		const parsed = parseTestDefinition(text);
		return parsed.ok ? { lines: describeDefinition(parsed.definition), problem: null } : { lines: [], problem: m.conformator_tests_steps_broken() };
	}
</script>

{#if tests.length === 0}
	<p class="mt-6">{m.conformator_tests_none()}</p>
{:else}
	<details class="mt-6 max-w-3xl text-sm">
		<summary class="cursor-pointer font-semibold">{m.conformator_tests_how_title()}</summary>
		<p class="mt-2">{m.conformator_tests_how_runner()}</p>
		<p class="mt-2">{m.conformator_tests_how_people()}</p>
	</details>

	<ol class="mt-4 flex flex-col gap-3" data-testid="test-list">
		{#each tests as test (test.conformator_test_id)}
			{@const s = test.kind === 'automated' ? steps(test) : null}
			<li class="rounded border border-surface-500/30 p-4" data-testid="test-{test.test_id}">
				<div class="flex flex-wrap items-center gap-2">
					<code>{test.test_id}</code>
					<span class="font-semibold">{test.title}</span>
					{#if test.mandatory}<Badge value="mandatory" tone="primary" />{/if}
					<span class="text-sm opacity-80">{m.conformator_tests_kind_severity({ kind: kinds[test.kind] ?? test.kind, severity: valueLabel(String(test.severity)) })}</span>
				</div>
				{#if test.expected_result}<p class="mt-1 text-sm"><span class="font-semibold">{m.conformator_tests_passes_when()}</span> {test.expected_result}</p>{/if}
				{#if test.requirements?.length}
					<p class="mt-1 text-sm">
						<span class="font-semibold">{m.conformator_tests_requirements()}</span>
						{#each test.requirements as req, i (req.id)}{i ? '; ' : ''}<code>{req.reference}</code> {req.title}{/each}
					</p>
				{/if}
				<details class="mt-2 text-sm">
					<summary class="cursor-pointer">{m.conformator_tests_what_it_does()}</summary>
					{#if s}
						{#if s.problem}
							<p class="mt-2">{s.problem}</p>
						{:else}
							<ol class="mt-2 list-inside list-decimal space-y-1">
								{#each s.lines as line, i (i)}<li>{line}</li>{/each}
							</ol>
						{/if}
					{:else}
						<p class="mt-2">{m.conformator_tests_person_decides({ evidence: test.evidence_required || m.conformator_tests_default_evidence() })}</p>
					{/if}
					{#if test.suggested_fix}<p class="mt-2"><span class="font-semibold">{m.conformator_tests_if_it_fails()}</span> {test.suggested_fix}</p>{/if}
				</details>
			</li>
		{/each}
	</ol>
{/if}
