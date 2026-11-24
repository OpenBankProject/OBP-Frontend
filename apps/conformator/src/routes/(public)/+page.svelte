<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { RichMessage } from '@obp/shared/components';
	import { m } from '@obp/shared/i18n';

	let { data } = $props();
</script>

<h1 class="h2">Conformator</h1>
<p class="mt-4 max-w-3xl">{m.conformator_home_intro()}</p>
<p class="mt-4 max-w-3xl">{m.conformator_home_not_a_licence()}</p>
<ul class="mt-6 flex flex-wrap gap-3">
	<li><a class="btn preset-filled" href="/prepare" data-testid="home-prepare">{m.conformator_nav_prepare()}</a></li>
	<!-- Each link is shown only when there is something behind it. When OBP-API cannot be reached the count is null and the link is not shown. -->
	{#if (data.content.suites ?? 0) > 0}
		<li><a class="btn preset-tonal" href="/catalogue" data-testid="home-catalogue">{m.conformator_home_see_catalogue()}</a></li>
	{:else if data.content.suites === 0 && data.isStaff}
		<li><a class="btn preset-tonal" href="/staff/suites" data-testid="home-build-catalogue">{m.conformator_build_catalogue()}</a></li>
	{/if}
	{#if (data.content.reports ?? 0) > 0}<li><a class="btn preset-tonal" href="/reports" data-testid="home-reports">{m.conformator_nav_reports()}</a></li>{/if}
	{#if data.isStaff}<li><a class="btn preset-tonal" href="/staff/participants">{m.conformator_nav_staff_participants()}</a></li>{/if}
</ul>

<!-- Written to stand on its own, so it can become the Glossary item "Conformator" in OBP-API. -->
<article id="about" class="mt-10 max-w-3xl space-y-8" data-testid="about">
	<section>
		<h2 class="h4">{m.conformator_home_who_title()}</h2>
		<ul class="mt-2 list-inside list-disc space-y-1">
			<li><RichMessage parts={m.conformator_home_who_participants.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_who_staff.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_who_anyone.parts()} /></li>
		</ul>
	</section>

	<section>
		<h2 class="h4">{m.conformator_home_catalogue_title()}</h2>
		<p class="mt-2"><RichMessage parts={m.conformator_home_catalogue_rules.parts()} /></p>
		<p class="mt-2">{m.conformator_home_catalogue_versions()}</p>
		<p class="mt-2">{m.conformator_home_kinds()}</p>
		<ul class="mt-2 list-inside list-disc space-y-1">
			<li><RichMessage parts={m.conformator_home_kind_automated.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_kind_evidence.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_kind_control.parts()} /></li>
		</ul>
	</section>

	<section>
		<h2 class="h4">{m.conformator_home_run_title()}</h2>
		<p class="mt-2"><RichMessage parts={m.conformator_home_run_runner.parts()} /></p>
		<p class="mt-2">{m.conformator_home_outcomes()}</p>
		<ul class="mt-2 list-inside list-disc space-y-1">
			<li><RichMessage parts={m.conformator_home_outcome_pass.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_outcome_fail.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_outcome_blocked.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_outcome_not_executed.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_outcome_not_applicable.parts()} /></li>
		</ul>
		<p class="mt-2">{m.conformator_home_run_kept()}</p>
	</section>

	<section>
		<h2 class="h4">{m.conformator_home_report_title()}</h2>
		<ol class="mt-2 list-inside list-decimal space-y-1">
			<li><RichMessage parts={m.conformator_home_report_submit.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_report_review.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_report_waiver.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_report_approve.parts()} /></li>
			<li><RichMessage parts={m.conformator_home_report_issue.parts()} /></li>
		</ol>
	</section>

	<section>
		<h2 class="h4">{m.conformator_home_data_title()}</h2>
		<p class="mt-2">{m.conformator_home_data()}</p>
	</section>
</article>
