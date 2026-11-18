<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	let { data } = $props();
</script>

<h1 class="h2">Conformator</h1>
<p class="mt-4 max-w-3xl">
	Conformator tests whether banks, payment service providers and third-party providers implement the open banking
	APIs, security profile and consent rules correctly. Tests run against participants' non-production systems. The regulator
	reviews the results and issues conformance reports.
</p>
<p class="mt-4 max-w-3xl">
	A conformance report shows that a system passed the technical tests it lists. It is not a licence, and it does not give
	access to live data or payments.
</p>
<ul class="mt-6 flex flex-wrap gap-3">
	<li><a class="btn preset-filled" href="/start" data-testid="home-start">Getting started</a></li>
	<!-- Each link is shown only when there is something behind it. When OBP-API cannot be reached the count is null and the link is not shown. -->
	{#if (data.content.suites ?? 0) > 0}
		<li><a class="btn preset-tonal" href="/catalogue" data-testid="home-catalogue">See the test catalogue</a></li>
	{:else if data.content.suites === 0 && data.isStaff}
		<li><a class="btn preset-tonal" href="/staff/suites" data-testid="home-build-catalogue">Build the test catalogue</a></li>
	{/if}
	{#if (data.content.reports ?? 0) > 0}<li><a class="btn preset-tonal" href="/reports" data-testid="home-reports">Check a report</a></li>{/if}
	{#if data.isStaff}<li><a class="btn preset-tonal" href="/staff/participants">Participants</a></li>{/if}
</ul>

<!-- Written to stand on its own, so it can become the Glossary item "Conformator" in OBP-API. -->
<article id="about" class="mt-10 max-w-3xl space-y-8" data-testid="about">
	<section>
		<h2 class="h4">Who uses it</h2>
		<ul class="mt-2 list-inside list-disc space-y-1">
			<li><strong>Participants</strong>: banks, payment service providers, fintechs and third-party providers. They add their non-production systems, run tests, give evidence and submit their results.</li>
			<li><strong>The regulator's staff</strong>: they keep the test catalogue, admit participants, review submissions and issue reports. Reviewers assess the tests a person must decide; approvers make the final decision. Nobody does both for the same submission.</li>
			<li><strong>Anyone</strong> can read the test catalogue and check a report.</li>
		</ul>
	</section>

	<section>
		<h2 class="h4">The test catalogue</h2>
		<p class="mt-2">
			The regulator's rules are recorded as <strong>requirements</strong>, one per clause. Tests are grouped into <strong>suites</strong>, each for one
			kind of system (an API provider such as a bank, an authorisation server, or an API consumer such as a third-party provider) and one family of
			APIs (account information, payment initiation, funds confirmation, consent or security). Each <strong>test</strong> has an ID that never
			changes, names the requirements it covers, says what a pass looks like, and is mandatory or not.
		</p>
		<p class="mt-2">
			A suite is a draft until it is approved. An approved suite never changes: a change is a new version, so every result keeps its meaning.
		</p>
		<p class="mt-2">There are three kinds of test:</p>
		<ul class="mt-2 list-inside list-disc space-y-1">
			<li><strong>Automated</strong>: the runner calls the participant's system and checks the answers.</li>
			<li><strong>Evidence review</strong>: the participant gives evidence, such as a policy or an audit record, and a reviewer decides.</li>
			<li><strong>Organisational control</strong>: a reviewer decides whether the organisation has something in place, such as a named person responsible for security.</li>
		</ul>
	</section>

	<section>
		<h2 class="h4">How a run works</h2>
		<p class="mt-2">
			A participant starts a run of an approved suite against one of their systems. The <strong>runner</strong>, a separate service, carries out each
			automated test's steps in order, as a real caller of the system would: over mutual TLS with its own certificate, as its own client of the
			system or on behalf of a test customer. A step sends a request, checks the answer (its status, fields, headers, or its shape against the
			suite's OpenAPI document), and can keep a value, such as a consent's id, for later steps. Security checks of an authorisation server are
			handed to the OpenID Foundation's conformance suite.
		</p>
		<p class="mt-2">Each test in a run gets one outcome:</p>
		<ul class="mt-2 list-inside list-disc space-y-1">
			<li><strong>pass</strong>: every step did what the test expects;</li>
			<li><strong>fail</strong>: the system answered, but not as expected, and the result says how;</li>
			<li><strong>blocked</strong>: the test could not go on. The result says whose side stopped it: the participant's (their system could not be reached) or the test platform's (the runner lacked something). A test platform problem is never counted against the participant;</li>
			<li><strong>not executed</strong>: an evidence or control test, waiting for a reviewer;</li>
			<li><strong>not applicable</strong>: decided by a reviewer.</li>
		</ul>
		<p class="mt-2">Every result keeps the requests and responses, with tokens and secrets hidden, and their correlation ids.</p>
	</section>

	<section>
		<h2 class="h4">From a run to a report</h2>
		<ol class="mt-2 list-inside list-decimal space-y-1">
			<li>The participant <strong>submits</strong> a finished run for review, and gives evidence for the evidence and control tests.</li>
			<li>A <strong>reviewer</strong> assesses those tests. An automated result cannot be overridden, unless the participant appeals it and the appeal is upheld.</li>
			<li>The participant can ask for a <strong>waiver</strong> of a test. An approved waiver has an end date, never changes the test's outcome, and is shown wherever the outcome is.</li>
			<li>An <strong>approver</strong>, who did not assess the submission, makes the final decision. A submission can be approved only when every mandatory test passed, is not applicable, or has an approved waiver.</li>
			<li>Approval issues a <strong>conformance report</strong>, digitally signed, with a reference such as CR-2026-7K3QX9MD. Anyone can check it on this site, or check its signature without this site using the published key. A report expires, and can be superseded by a newer one or withdrawn.</li>
		</ol>
	</section>

	<section>
		<h2 class="h4">Where the data is kept</h2>
		<p class="mt-2">
			Everything is kept in OBP-API, as dynamic entities. The catalogue, the participant register and the reports are in one central space. Each
			participant's systems, runs, results, evidence and the regulator's decisions about them are in a space of their own, so OBP-API's Roles keep
			each participant's data apart from every other's. Secrets the runner needs, such as client certificates, are kept by the runner, never in
			OBP-API.
		</p>
	</section>
</article>
