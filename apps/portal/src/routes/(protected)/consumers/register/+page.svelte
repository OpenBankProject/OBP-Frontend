<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let showAdvanced = $state(false);
</script>

<div
	class="card dark:bg-primary-500/50 backdrop-blur-3xl border-primary-200-800 divide-primary-200-800 mx-auto my-10 md:px-15 flex flex-col divide-y shadow-lg w-[90%] lg:max-w-3xl"
>
	<header class="py-4">
		<h1 class="h4 text-center">Register a consumer</h1>
	</header>
	<article class="space-y-4 p-4">
		{#if form?.message}
			<div class="bg-error-500/10 border-error-500 rounded-lg border p-4 text-center">
				<p class="text-error-500 font-semibold">{form.message}</p>
			</div>
		{/if}
		<form class="w-full space-y-6 pb-10" method="POST">
			<label class="label">
				<span class="label-text">Application Type</span>
				<select class="select" name="app_type" required>
					<option value="public">Public</option>
					<option value="confidential">Confidential</option>
				</select>
			</label>

			<!-- --- -->
			<label class="label">
				<span class="label-text">Application Name</span>
				<input type="text" class="input" name="app_name" placeholder="Enter Application Name" required/>
			</label>
			<!-- --- -->
			<label class="label">
				<span class="label-text">Redirect Url</span>
				<input type="url" class="input" name="redirect_url" placeholder="i.e. http://localhost:8080/callback" />
			</label>
			<!-- this should be automatically filled out if the user is registered -->
			<label class="label">
				<span class="label-text">Developer Email</span>
				<input type="email" class="input" name="developer_email" placeholder="john@example.com" required/>
			</label>
			<!-- --- -->
			<label class="label">
				<span class="label-text">Description</span>
				<textarea class="input" name="description" placeholder="Enter a short description of the application..." required></textarea>
			</label>

            <label class="label">
				<span class="label-text text-left">Company</span>
				<input type="text" class="input" name="company" placeholder="Enter Company Name" required/>
			</label>

            <details data-testid="advanced-section" bind:open={showAdvanced}>
				<summary class="cursor-pointer select-none flex items-center gap-2 text-sm font-medium">
					<span class="transition-transform {showAdvanced ? 'rotate-90' : ''}">&#9654;</span>
					Advanced
				</summary>
				<label class="label mt-4">
					<span class="label-text">Client Certificate (PEM)</span>
					<textarea
						class="input font-mono text-sm"
						name="client_certificate"
						data-testid="client-certificate-input"
						placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
						rows="6"
					></textarea>
				</label>
			</details>

            <button type="submit" aria-label="submit" class="btn preset-filled-primary-500 w-full mt-5">Submit</button>
		</form>
	</article>
</div>
