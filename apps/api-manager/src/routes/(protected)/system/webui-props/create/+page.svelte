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
  import { page } from "$app/state";
  import WebUiPropForm from "$lib/components/webui-props/WebUiPropForm.svelte";

  // ?name= prefills the name (the list links known-but-unset props here)
  const initialName = page.url.searchParams.get("name") ?? "";
</script>

<svelte:head>
  <title>Create WebUI Prop - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <h1 class="mb-6 text-3xl font-bold text-gray-900 dark:text-gray-100">Create WebUI Prop</h1>
  <div class="mx-auto max-w-3xl">
    <WebUiPropForm mode="create" {initialName} />
  </div>
</div>
