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
	import { MissingRoleAlert } from '@obp/shared/components';

	let { data, form } = $props();

	const outcomeTone: Record<string, 'success' | 'error' | 'warning' | 'surface'> = { pass: 'success', fail: 'error', blocked: 'warning', not_executed: 'surface', not_applicable: 'surface' };
	const statusTone: Record<string, 'primary' | 'success' | 'error'> = { submitted: 'primary', under_review: 'primary', approved: 'success', refused: 'error' };
	const title = $derived(new Map(data.tests.map((t) => [String(t.test_id), String(t.title)])));
	const kindOf = $derived(new Map(data.tests.map((t) => [String(t.test_id), String(t.kind)])));
	const manualTests = $derived(data.tests.filter((t) => t.kind !== 'automated'));
	const decidedWaivers = $derived(new Set(data.waiverDecisions.map((d) => String(d.waiver_request_id))));
	const decidedAppeals = $derived(new Set(data.appealDecisions.map((d) => String(d.appeal_id))));
	// Decided and final, unless an upheld appeal about a refusal opened it again.
	const decided = $derived(!data.open);
	const assigned = $derived(data.assignments.some((a) => a.reviewer_user_id === data.me));
	const appealable = $derived([
		...data.results.filter((r) => r.outcome !== 'pass').map((r) => ({ value: `conformator_result:${r.conformator_result_id}`, label: `Result of ${r.test_id}: ${String(r.outcome).replaceAll('_', ' ')}` })),
		...data.assessments.map((a) => ({ value: `conformator_assessment:${a.conformator_assessment_id}`, label: `Assessment of ${a.test_id}: ${String(a.outcome).replaceAll('_', ' ')}` })),
		...data.approvals.filter((a) => a.approved !== true).map((a) => ({ value: `conformator_approval:${a.conformator_approval_id}`, label: 'The refusal of this submission' }))
	]);
	const outcomeNote: Record<string, string> = { run: 'from the run', assessment: "from a reviewer's assessment", none: '' };
</script>

<p><a class="anchor" href="/spaces/{data.space}">{data.name}</a></p>
<h1 class="h2 mt-2">Submission of {data.system?.name ?? 'a system'} against {data.suite ? `${data.suite.name} ${data.suite.version}` : 'a suite'}</h1>
<p class="mt-2">
	<Badge value={data.status} tone={statusTone[data.status]} />
	<span class="text-sm">submitted {data.submission.submitted_at}</span>
	{#each data.runIds as runId, i (runId)}<a class="anchor ms-2 text-sm" href="/spaces/{data.space}/runs/{runId}">run {i + 1}</a>{/each}
</p>
{#if data.submission.note}<p class="mt-2 max-w-3xl text-sm">Note from the participant: {data.submission.note}</p>{/if}

{#if form?.done}<p class="mt-4 preset-tonal-success rounded p-3" role="status">{form.done}</p>{/if}
{#if form?.problem}<p class="mt-4 preset-tonal-error rounded p-3" role="alert">{form.problem}</p>{/if}

{#each data.reports as report (report.reference)}
	<p class="mt-4 preset-tonal-success rounded p-3">Conformance report <a class="anchor font-semibold" href="/reports/{report.reference}">{report.reference}</a>, valid until {report.expires_on}.</p>
{/each}

<section class="mt-6 rounded border border-surface-500/30 p-4" data-testid="submission-summary">
	{#if data.blockers.length}
		<p class="font-semibold">Not ready for approval:</p>
		<ul class="list-inside list-disc">{#each data.blockers as b, i (i)}<li>{b}</li>{/each}</ul>
	{:else}
		<p class="font-semibold">Every mandatory test has passed, is not applicable, or has an approved waiver.</p>
	{/if}
</section>

<table class="table mt-6" data-testid="submission-tests">
	<thead><tr><th>Test</th><th>Outcome</th><th>Evidence, waivers and appeals</th></tr></thead>
	<tbody>
		{#each data.rows as row (row.test_id)}
			<tr id={row.test_id}>
				<td>
					<code>{row.test_id}</code>
					{#if row.mandatory}<Badge value="mandatory" tone="primary" />{/if}
					<span class="block text-sm">{title.get(row.test_id)}</span>
				</td>
				<td>
					<Badge value={row.outcome} tone={outcomeTone[row.outcome] ?? 'surface'} />
					<span class="block text-xs">{outcomeNote[row.source]}</span>
					{#if row.waiver}<span class="block text-sm text-warning-500">Waived until {row.waiver.expires_on}: {row.waiver.reason}</span>{/if}
				</td>
				<td class="text-sm">
					{#each data.evidence.filter((e) => e.test_id === row.test_id) as e (e.conformator_evidence_id)}
						<p>Evidence: {e.note}
							{#each e.files as f (f.file_id)}
								{#if f.scan_status === 'clean'}<a class="anchor ms-1" href="/spaces/{data.space}/files/{f.file_id}">{f.file_name}</a>{:else}<span class="ms-1">{f.file_name} ({f.scan_status})</span>{/if}
							{/each}
						</p>
					{/each}
					{#each data.assessments.filter((a) => a.test_id === row.test_id) as a (a.conformator_assessment_id)}
						<p>Assessed {String(a.outcome).replaceAll('_', ' ')}: {a.reason}</p>
					{/each}
					{#each data.waiverRequests.filter((w) => w.test_id === row.test_id) as w (w.conformator_waiver_request_id)}
						<p>Waiver asked until {w.requested_until}: {w.reason}
							{#each data.waiverDecisions.filter((d) => d.waiver_request_id === w.conformator_waiver_request_id) as d (d.conformator_waiver_decision_id)}
								<span class="block">{d.approved ? `Approved until ${d.expires_on}` : 'Refused'}: {d.reason}</span>
							{/each}
						</p>
					{/each}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

{#if data.appeals.length}
	<section class="mt-6" data-testid="submission-appeals">
		<h2 class="h4">Appeals</h2>
		<ul class="mt-2 flex flex-col gap-2">
			{#each data.appeals as a (a.conformator_appeal_id)}
				<li class="rounded border border-surface-500/30 p-3 text-sm">
					<p>About {String(a.about_entity).replace('conformator_', '')} <code>{a.about_id}</code>: {a.reason}</p>
					{#each data.appealDecisions.filter((d) => d.appeal_id === a.conformator_appeal_id) as d (d.conformator_appeal_decision_id)}
						<p class="mt-1">{d.upheld ? 'Upheld' : 'Not upheld'}: {d.reason}</p>
					{/each}
					{#if data.can.decideAppeal && !decidedAppeals.has(String(a.conformator_appeal_id))}
						<form method="POST" action="?/decideAppeal" class="mt-2 flex flex-wrap items-end gap-2">
							<input type="hidden" name="appeal_id" value={a.conformator_appeal_id} />
							<select class="select w-auto" name="upheld"><option value="no">Not upheld</option><option value="yes">Upheld</option></select>
							<input class="input flex-1" name="reason" required maxlength="4000" placeholder="Why" />
							<button class="btn btn-sm preset-filled">Decide</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<!-- The participant's side -->
{#if !decided && (data.can.addEvidence || data.can.requestWaiver || data.can.appeal)}
	<section class="mt-8 grid gap-6 md:grid-cols-2" data-testid="submission-participant">
		{#if data.can.addEvidence && manualTests.length}
			<form method="POST" action="?/addEvidence" enctype="multipart/form-data" class="grid gap-2 rounded border border-surface-500/30 p-4">
				<h2 class="h5">Add evidence</h2>
				<label class="label"><span>For the test</span>
					<select class="select" name="test_id">{#each manualTests as t (t.test_id)}<option value={t.test_id}>{t.test_id} {t.title}</option>{/each}</select>
				</label>
				<label class="label"><span>What it shows</span><textarea class="textarea" name="note" rows="2" required maxlength="4000"></textarea></label>
				<label class="label"><span>A file (PDF, PNG, JPEG or WebP, up to 5 MB)</span><input class="input" type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" /></label>
				<div><button class="btn preset-filled">Add the evidence</button></div>
			</form>
		{/if}
		{#if data.can.requestWaiver}
			<form method="POST" action="?/requestWaiver" class="grid gap-2 rounded border border-surface-500/30 p-4">
				<h2 class="h5">Ask for a waiver</h2>
				<label class="label"><span>Of the test</span>
					<select class="select" name="test_id">{#each data.tests as t (t.test_id)}<option value={t.test_id}>{t.test_id} {t.title}</option>{/each}</select>
				</label>
				<label class="label"><span>Why</span><textarea class="textarea" name="reason" rows="2" required maxlength="4000"></textarea></label>
				<label class="label"><span>Until</span><input class="input" type="date" name="requested_until" required /></label>
				<div><button class="btn preset-tonal">Ask</button></div>
			</form>
		{/if}
	</section>
{/if}
{#if data.can.appeal && appealable.length}
	<form method="POST" action="?/appeal" class="mt-6 grid max-w-3xl gap-2 rounded border border-surface-500/30 p-4" data-testid="submission-appeal">
		<h2 class="h5">Appeal</h2>
		<label class="label"><span>What is wrong</span>
			<select class="select" name="about">{#each appealable as o (o.value)}<option value={o.value}>{o.label}</option>{/each}</select>
		</label>
		<label class="label"><span>Why</span><textarea class="textarea" name="reason" rows="2" required maxlength="4000"></textarea></label>
		<div><button class="btn preset-tonal">Appeal</button></div>
	</form>
{/if}

<!-- The regulator's side -->
{#if data.can.assign || data.can.assess || data.can.decideWaiver}
	<section class="mt-8" data-testid="submission-review">
		<h2 class="h4">Review</h2>
		<p class="mt-1 text-sm">Reviewers: {data.assignments.length ? data.assignments.map((a) => a.reviewer_user_id).join(', ') : 'none yet'}</p>
		{#if data.can.assign && !assigned && !decided}
			<form method="POST" action="?/assignMe" class="mt-2"><button class="btn btn-sm preset-tonal">Review this submission</button></form>
		{/if}
		{#if data.can.assess && !decided}
			<form method="POST" action="?/assess" class="mt-4 grid max-w-3xl gap-2 rounded border border-surface-500/30 p-4">
				<h3 class="h5">Assess a test</h3>
				<p class="text-sm">Evidence and control tests are decided here. An automated result can only be assessed again after an appeal about it is upheld.</p>
				<div class="grid gap-2 md:grid-cols-2">
					<label class="label"><span>Test</span>
						<select class="select" name="test_id">{#each data.tests as t (t.test_id)}<option value={t.test_id}>{t.test_id} ({kindOf.get(String(t.test_id))})</option>{/each}</select>
					</label>
					<label class="label"><span>Outcome</span>
						<select class="select" name="outcome"><option value="pass">Pass</option><option value="fail">Fail</option><option value="not_applicable">Not applicable</option></select>
					</label>
				</div>
				<label class="label"><span>Why</span><textarea class="textarea" name="reason" rows="2" required maxlength="4000"></textarea></label>
				<div><button class="btn preset-filled">Record the assessment</button></div>
			</form>
		{/if}
		{#if data.can.decideWaiver}
			{#each data.waiverRequests.filter((w) => !decidedWaivers.has(String(w.conformator_waiver_request_id))) as w (w.conformator_waiver_request_id)}
				<form method="POST" action="?/decideWaiver" class="mt-4 grid max-w-3xl gap-2 rounded border border-surface-500/30 p-4">
					<h3 class="h5">Waiver of {w.test_id}, asked until {w.requested_until}</h3>
					<p class="text-sm">{w.reason}</p>
					<input type="hidden" name="waiver_request_id" value={w.conformator_waiver_request_id} />
					<div class="grid gap-2 md:grid-cols-2">
						<select class="select" name="approved"><option value="yes">Approve</option><option value="no">Refuse</option></select>
						<label class="label"><span>Ends on (if approved)</span><input class="input" type="date" name="expires_on" value={w.requested_until} /></label>
					</div>
					<input class="input" name="reason" required maxlength="4000" placeholder="Why" />
					<div><button class="btn preset-filled">Decide</button></div>
				</form>
			{/each}
		{/if}
	</section>
{/if}

{#if (data.can.approve || data.can.approveWithoutReport) && !decided}
	<section class="mt-8 rounded border border-surface-500/30 p-4" data-testid="submission-decide">
		<h2 class="h4">Final decision</h2>
		{#if !data.can.approveAsMe}
			<p class="mt-2">You assessed tests of this submission, so another person makes the final decision.</p>
		{:else if data.can.approveWithoutReport}
			<p class="mt-2">Approving issues a report in the central space, so it needs this Role there too:</p>
			<div class="mt-2"><MissingRoleAlert roles={['CanCreateDynamicEntityRecord_conformator_report']} bankId={data.centralSpace} /></div>
		{:else}
			{#if !data.signingReady}<p class="mt-2 preset-tonal-warning rounded p-2">{data.signingProblem}</p>{/if}
			<form method="POST" action="?/decide" class="mt-2 grid max-w-3xl gap-2">
				<select class="select" name="approved">
					<option value="yes" disabled={data.blockers.length > 0 || !data.signingReady}>Approve, and issue the signed report</option>
					<option value="no" selected={data.blockers.length > 0}>Refuse</option>
				</select>
				<input class="input" name="reason" required maxlength="4000" placeholder="Why" />
				<div><button class="btn preset-filled" data-testid="submission-decide-button">Record the decision</button></div>
			</form>
		{/if}
	</section>
{/if}
{#if data.can.approve && data.latestApproval?.approved === true && data.reports.length === 0}
	<form method="POST" action="?/issueReport" class="mt-4"><button class="btn preset-filled">Issue the report</button></form>
{/if}
