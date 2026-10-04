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
  import type { PageData } from "./$types";
  import WebUiPropForm from "$lib/components/webui-props/WebUiPropForm.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.prop.name} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <h1 class="mb-1 font-mono text-2xl font-bold text-gray-900 dark:text-gray-100">{data.prop.name}</h1>
  <p class="mb-6 text-xs text-gray-500 dark:text-gray-400">Source: {data.prop.source}</p>
  <div class="mx-auto max-w-3xl">
    <WebUiPropForm mode="edit" initialName={data.prop.name} initialValue={data.prop.value} />
  </div>
</div>
