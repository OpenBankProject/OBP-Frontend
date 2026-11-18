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

	let { data, form } = $props();
	const c = $derived(data.content);
	const genuine = $derived(data.check.hashMatches && data.check.signatureValid);
	const standingTone: Record<string, 'success' | 'warning' | 'error'> = { valid: 'success', expired: 'warning', superseded: 'warning', withdrawn: 'error' };
</script>

<p><a class="anchor" href="/reports">Check a report</a></p>
<h1 class="h2 mt-2">Conformance report {data.report.reference}</h1>

<section class="mt-4 rounded border-2 p-4 {genuine ? 'border-success-500' : 'border-error-500'}" data-testid="report-check">
	<p class="text-lg font-semibold">
		{#if !genuine}This report cannot be trusted: {!data.check.hashMatches ? 'its content does not match its hash' : !data.check.keyKnown ? 'it was not signed with the published key' : 'its signature is not valid'}.
		{:else if data.standing === 'valid'}Genuine and valid until {data.report.expires_on}.
		{:else}Genuine, but {data.standing}.{/if}
	</p>
	<p class="mt-1"><Badge value={data.standing} tone={standingTone[data.standing]} /></p>
	{#if data.ending}<p class="mt-2">{data.ending.event === 'withdrawn' ? 'Withdrawn' : 'Superseded'} on {String(data.ending.created_at).slice(0, 10)}: {data.ending.reason}
		{#if data.replacedBy}<a class="anchor" href="/reports/{data.replacedBy}">See {data.replacedBy}</a>{/if}</p>{/if}
</section>

<p class="mt-4 max-w-3xl font-semibold">{c.statement}</p>

<dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
	<dt>Participant</dt><dd>{c.participant?.legal_name} ({String(c.participant?.category ?? '').replaceAll('_', ' ')})</dd>
	<dt>System</dt><dd>{c.system?.name}, {String(c.system?.system_role ?? '').replaceAll('_', ' ')}, <code>{c.system?.base_url}</code></dd>
	<dt>Suite</dt><dd>{c.suite?.name} <code>{c.suite?.code}</code> version {c.suite?.version}</dd>
	<dt>Issued</dt><dd>{c.issued_on}</dd>
	<dt>Expires</dt><dd>{c.expires_on}</dd>
	<dt>Decision</dt><dd>{c.approval?.reason}</dd>
</dl>

<table class="table mt-6" data-testid="report-tests">
	<thead><tr><th>Test</th><th>Outcome</th><th>Waiver</th></tr></thead>
	<tbody>
		{#each c.tests ?? [] as t (t.test_id)}
			<tr>
				<td><code>{t.test_id}</code> {t.title} {#if t.mandatory}<Badge value="mandatory" tone="primary" />{/if}</td>
				<td>{String(t.outcome).replaceAll('_', ' ')}{t.decided_by === 'assessment' ? ', by assessment' : ''}</td>
				<td>{#if t.waiver}until {t.waiver.expires_on}: {t.waiver.reason}{/if}</td>
			</tr>
		{/each}
	</tbody>
</table>

<p class="mt-4 text-sm">
	Hash <code class="break-all">{data.report.report_hash}</code>, signed with key <code>{data.report.signing_key_id}</code>.
	<a class="anchor" href="/reports/{data.report.reference}/report.json" download>Download the signed report (JSON)</a> ·
	<a class="anchor" href="/reports/signing-key">Public key</a> · Print this page to keep a PDF.
</p>

{#if form?.done}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{form.done}</p>{/if}
{#if form?.problem}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{form.problem}</p>{/if}
{#if data.canWithdraw}
	<form method="POST" action="?/withdraw" class="mt-6 flex max-w-3xl items-end gap-2 print:hidden" data-testid="report-withdraw">
		<label class="label flex-1"><span>Withdraw this report, because</span><input class="input" name="reason" required maxlength="4000" /></label>
		<button class="btn preset-tonal-error">Withdraw</button>
	</form>
{/if}
