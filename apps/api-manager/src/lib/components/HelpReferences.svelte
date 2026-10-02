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
  import { ExternalLink } from "@lucide/svelte";

  /**
   * The bottom of a help page, set small like references: the glossary entries the
   * page is made of (Sources), then related pages such as the list page or the API
   * Explorer (Links). Links to other sites open in a new tab.
   */
  let {
    sources = [],
    links = [],
  }: {
    sources?: { title: string; explorerUrl: string }[];
    links?: { label: string; href: string; testid?: string }[];
  } = $props();

  const isExternal = (href: string) => /^https?:\/\//i.test(href);
</script>

{#if sources.length > 0 || links.length > 0}
  <footer class="references" data-testid="help-references">
    {#if sources.length > 0}
      <div class="row" data-testid="help-sources">
        <span class="row-label">Sources</span>
        <ul class="row-list">
          {#each sources as s, i (`${s.title}-${i}`)}
            <li>
              <a href={s.explorerUrl} target="_blank" rel="noopener noreferrer" data-testid="help-source-{i}">
                Glossary: {s.title} <ExternalLink size={11} />
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    {#if links.length > 0}
      <div class="row" data-testid="help-links">
        <span class="row-label">Links</span>
        <ul class="row-list">
          {#each links as l, i (`${l.href}-${i}`)}
            <li>
              {#if isExternal(l.href)}
                <a href={l.href} target="_blank" rel="noopener noreferrer" data-testid={l.testid ?? `help-link-${i}`}>
                  {l.label} <ExternalLink size={11} />
                </a>
              {:else}
                <a href={l.href} data-testid={l.testid ?? `help-link-${i}`}>{l.label}</a>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </footer>
{/if}

<style>
  .references {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    border-top: 1px solid #e5e7eb;
    padding-top: 0.75rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .row-label {
    flex-shrink: 0;
    width: 3.5rem;
    font-weight: 600;
  }

  .row-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row-list a {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    color: #2563eb;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :global([data-mode="dark"]) .references {
    border-top-color: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .row-list a {
    color: #60a5fa;
  }
</style>
