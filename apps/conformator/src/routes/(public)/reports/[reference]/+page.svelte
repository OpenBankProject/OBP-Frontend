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
	import { valueLabel } from '$lib/valueLabel';
	import { RichMessage } from '@obp/shared/components';
	import { formatDay, m } from '@obp/shared/i18n';

	let { data, form } = $props();
	const c = $derived(data.content);
	const genuine = $derived(data.check.hashMatches && data.check.signatureValid);
	const standingTone: Record<string, 'success' | 'warning' | 'error'> = { valid: 'success', expired: 'warning', superseded: 'warning', withdrawn: 'error' };
</script>

<p><a class="anchor" href="/reports">{m.conformator_nav_reports()}</a></p>
<h1 class="h2 mt-2">{m.conformator_report_title({ reference: data.report.reference })}</h1>

<section class="mt-4 rounded border-2 p-4 {genuine ? 'ui-tone-success' : 'ui-tone-error'}" data-testid="report-check">
	<p class="text-lg font-semibold">
		{#if !genuine}{m.conformator_report_untrusted({
				reason: !data.check.hashMatches ? m.conformator_report_bad_hash() : !data.check.keyKnown ? m.conformator_report_unknown_key() : m.conformator_report_bad_signature()
			})}
		{:else if data.standing === 'valid'}{m.conformator_report_valid_until({ date: formatDay(String(data.report.expires_on)) })}
		{:else}{m.conformator_report_genuine_but({ standing: valueLabel(data.standing) })}{/if}
	</p>
	<p class="mt-1"><Badge value={data.standing} tone={standingTone[data.standing]} /></p>
	{#if data.ending}<p class="mt-2">{(data.ending.event === 'withdrawn' ? m.conformator_report_withdrawn_on : m.conformator_report_superseded_on)({ date: formatDay(String(data.ending.created_at)), reason: String(data.ending.reason ?? '') })}
		{#if data.replacedBy}<a class="anchor" href="/reports/{data.replacedBy}">{m.conformator_report_see({ reference: data.replacedBy })}</a>{/if}</p>{/if}
</section>

<p class="mt-4 max-w-3xl font-semibold">{c.statement}</p>

<dl class="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
	<dt>{m.conformator_report_participant()}</dt><dd>{c.participant?.legal_name} ({valueLabel(String(c.participant?.category ?? ''))})</dd>
	<dt>{m.conformator_report_system()}</dt><dd>{c.system?.name}, {valueLabel(String(c.system?.system_role ?? ''))}, <code>{c.system?.base_url}</code></dd>
	<dt>{m.conformator_report_suite()}</dt><dd>{c.suite?.name} <code>{c.suite?.code}</code> {m.version({ version: String(c.suite?.version ?? '') })}</dd>
	<dt>{m.conformator_report_issued()}</dt><dd>{formatDay(String(c.issued_on ?? ''))}</dd>
	<dt>{m.conformator_report_expires()}</dt><dd>{formatDay(String(c.expires_on ?? ''))}</dd>
	<dt>{m.conformator_report_decision()}</dt><dd>{c.approval?.reason}</dd>
</dl>

<table class="table mt-6" data-testid="report-tests">
	<thead><tr><th>{m.conformator_report_test()}</th><th>{m.conformator_report_outcome()}</th><th>{m.conformator_report_waiver()}</th></tr></thead>
	<tbody>
		{#each c.tests ?? [] as t (t.test_id)}
			<tr>
				<td><code>{t.test_id}</code> {t.title} {#if t.mandatory}<Badge value="mandatory" tone="primary" />{/if}</td>
				<td>{valueLabel(String(t.outcome))}{t.decided_by === 'assessment' ? m.conformator_report_by_assessment() : ''}</td>
				<td>{#if t.waiver}{m.conformator_report_waiver_until({ date: formatDay(String(t.waiver.expires_on)), reason: String(t.waiver.reason ?? '') })}{/if}</td>
			</tr>
		{/each}
	</tbody>
</table>

<!-- The hash is long, so its code may break anywhere -->
<p class="mt-4 text-sm [&_code]:break-all">
	<RichMessage parts={m.conformator_report_hash_and_key.parts({ hash: String(data.report.report_hash), key: String(data.report.signing_key_id) })} />
	<a class="anchor" href="/reports/{data.report.reference}/report.json" download>{m.conformator_report_download()}</a> ·
	<a class="anchor" href="/reports/signing-key">{m.conformator_report_public_key()}</a> · {m.conformator_report_print()}
</p>

{#if form?.done}<p class="mt-4 ui-tone-success rounded p-3" role="status">{form.done}</p>{/if}
{#if form?.problem}<p class="mt-4 ui-tone-error rounded p-3" role="alert">{form.problem}</p>{/if}
{#if data.canWithdraw}
	<form method="POST" action="?/withdraw" class="mt-6 flex max-w-3xl items-end gap-2 print:hidden" data-testid="report-withdraw">
		<label class="label flex-1"><span>{m.conformator_report_withdraw_because()}</span><input class="input" name="reason" required maxlength="4000" /></label>
		<button class="btn preset-filled-error-500">{m.conformator_report_withdraw()}</button>
	</form>
{/if}
