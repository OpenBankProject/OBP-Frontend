<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<!--
  An app's error page, in the page's language: use it in the app's src/routes/+error.svelte. A missing page and a
  forbidden page get their own words; any other error shows the error's own message, which comes from the app.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$shared/i18n';

	const status = $derived(page.status);
	const title = $derived(status === 404 ? m.error_not_found_title() : status === 403 ? m.error_forbidden_title() : m.error_title());
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div class="mx-auto max-w-2xl p-8" data-testid="error-page">
	<p class="text-sm opacity-70">{m.error_status({ status: String(status) })}</p>
	<h1 class="h2 mt-1">{title}</h1>
	{#if status === 404}
		<p class="mt-4">{m.error_not_found_text()}</p>
	{:else if page.error?.message}
		<p class="mt-4" data-testid="error-message">{page.error.message}</p>
	{/if}
	<p class="mt-6"><a class="btn preset-filled-primary-500" href="/">{m.error_go_home()}</a></p>
</div>
