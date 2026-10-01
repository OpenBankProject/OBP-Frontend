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
	import type { PageData } from './$types';
	import { SystemStatusPage } from '@obp/shared/components';
	import { env } from '$env/dynamic/public';

	let { data }: { data: PageData } = $props();

	const SOURCE_LABEL = { webui_prop: 'webui_prop', env: 'env var', default: 'default' } as const;
</script>

<SystemStatusPage
	{data}
	title="System Status - OBP Portal"
	opeyPublicUrl={env.PUBLIC_OPEY_BASE_URL}
	buildInfo={{
		version: __APP_VERSION__,
		commit: __GIT_COMMIT__,
		branch: __GIT_BRANCH__,
		buildTime: __BUILD_TIME__
	}}
>
	<div class="mt-8" data-testid="configured-text">
		<h2 class="mb-4 text-2xl font-bold">Configured Text</h2>
		<div class="overflow-x-auto rounded-lg bg-white shadow dark:bg-gray-800">
			<table class="w-full text-left text-sm">
				<thead class="text-xs uppercase text-gray-500 dark:text-gray-400">
					<tr>
						<th class="px-4 py-2">webui_prop</th>
						<th class="px-4 py-2">Env var</th>
						<th class="px-4 py-2">In use</th>
					</tr>
				</thead>
				<tbody>
					{#each Object.values(data.webUiText) as text (text.envVar)}
						<tr class="border-t border-gray-100 dark:border-gray-700" data-testid="configured-text-{text.envVar}">
							<td class="px-4 py-2 font-mono">{text.webUiPropName}</td>
							<td class="px-4 py-2 font-mono">{text.envVar}</td>
							<td class="px-4 py-2" data-source={text.source}>{SOURCE_LABEL[text.source]}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</SystemStatusPage>
