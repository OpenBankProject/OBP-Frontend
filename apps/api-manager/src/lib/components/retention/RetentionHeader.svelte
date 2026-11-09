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
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID } from "@obp/shared/obp";

  /** The retention pages' heading, their tabs and the space picker (SYS first, then the banks). */
  interface Props {
    title: string;
    intro: string;
    bankId: string;
    bankIds: string[];
  }
  let { title, intro, bankId, bankIds }: Props = $props();

  const tabs = [
    { href: "/retention", label: "Policies" },
    { href: "/retention/runs", label: "Runs" },
    { href: "/retention/holds", label: "Legal holds" },
    { href: "/retention/archive", label: "Archive" },
  ];
  const spaces = $derived([...new Set([DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID, ...bankIds, bankId])]);
  const current = $derived(page.url.pathname);

  function chooseSpace(e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value;
    // A record belongs to one space, so changing space goes back to the tab's list.
    const tab = [...tabs].reverse().find((t) => current.startsWith(t.href))?.href ?? "/retention";
    goto(`${tab}?bank_id=${encodeURIComponent(value)}`);
  }
</script>

<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
  <div class="max-w-3xl">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
    <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{intro}</p>
  </div>
  <div class="flex items-center gap-2">
    <label for="space" class="text-sm text-gray-700 dark:text-gray-300">Space</label>
    <select id="space" value={bankId} onchange={chooseSpace} class="rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" data-testid="space-select">
      {#each spaces as s (s)}<option value={s}>{s}</option>{/each}
    </select>
  </div>
</div>

<nav aria-label="Data retention" class="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
  {#each tabs as tab (tab.href)}
    {@const active = tab.href === "/retention" ? current === "/retention" || /^\/retention\/[^/]+\/[^/]+$/.test(current) : current.startsWith(tab.href)}
    <a
      href="{tab.href}?bank_id={encodeURIComponent(bankId)}"
      aria-current={active ? "page" : undefined}
      class="rounded-lg px-3 py-1.5 text-sm font-medium {active ? 'bg-blue-600 text-white dark:bg-blue-500' : 'text-gray-700 dark:text-gray-300'}"
      data-testid="retention-tab-{tab.label.toLowerCase().replace(' ', '-')}">{tab.label}</a>
  {/each}
</nav>
