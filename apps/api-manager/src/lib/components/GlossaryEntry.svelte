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
  /**
   * One OBP glossary entry, rendered from its markdown (already converted to HTML on the
   * server with renderMarkdown, which escapes raw HTML). The glossary is the single source
   * of explanatory text in the Manager: pages show it, they do not paraphrase it.
   * Pages list the glossary links once, at the bottom, with HelpReferences.
   */
  let {
    html,
    testid = "glossary-entry",
  }: { html: string | null; testid?: string } = $props();
</script>

{#if html}
  <div class="glossary-body" data-testid={testid}>{@html html}</div>
{:else}
  <p class="glossary-missing" data-testid="{testid}-missing">Not in this OBP instance's glossary.</p>
{/if}

<style>
  .glossary-body {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: #374151;
  }

  .glossary-body :global(h1) {
    display: none; /* the page already carries the title */
  }

  .glossary-body :global(h2) {
    font-size: 1.0625rem;
    font-weight: 600;
    margin: 1.25rem 0 0.5rem;
    color: #111827;
  }

  .glossary-body :global(h3) {
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 1rem 0 0.375rem;
    color: #111827;
  }

  .glossary-body :global(p) {
    margin: 0 0 0.75rem;
  }

  .glossary-body :global(ul),
  .glossary-body :global(ol) {
    margin: 0 0 0.75rem 1.25rem;
    padding: 0;
  }

  .glossary-body :global(li) {
    margin-bottom: 0.25rem;
  }

  .glossary-body :global(code) {
    font-size: 0.85em;
    background: #f3f4f6;
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
  }

  .glossary-body :global(pre) {
    overflow-x: auto;
    background: #111827;
    color: #e5e7eb;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    margin: 0 0 0.75rem;
  }

  .glossary-body :global(pre code) {
    background: none;
    padding: 0;
    color: inherit;
  }

  .glossary-body :global(a) {
    color: #2563eb;
    text-decoration: underline;
  }

  .glossary-missing {
    color: #6b7280;
    font-size: 0.9375rem;
  }



  :global([data-mode="dark"]) .glossary-body {
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .glossary-body :global(h2),
  :global([data-mode="dark"]) .glossary-body :global(h3) {
    color: var(--color-surface-50);
  }

  :global([data-mode="dark"]) .glossary-body :global(code) {
    background: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .glossary-body :global(a) {
    color: #60a5fa;
  }

  :global([data-mode="dark"]) .glossary-missing {
    color: var(--color-surface-400);
  }

</style>
