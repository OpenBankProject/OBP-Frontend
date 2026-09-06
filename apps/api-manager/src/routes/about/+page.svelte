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
  import { env } from "$env/dynamic/public";

  function formatBuildTime(isoString: string): string {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  }
</script>

<div class="mx-auto max-w-3xl px-6 py-10">
  <h1 class="h2 mb-6" data-testid="about-title">About</h1>

  <div class="space-y-4 text-sm text-surface-700-300">
    <p>
      The <strong>Open Bank Project API Manager</strong> helps you manage your OBP API instance,
      configure settings, manage roles and entitlements, and explore the full power of the
      Open Bank Project.
    </p>

    <p>
      For more information visit
      <a
        href="https://www.openbankproject.com"
        class="text-primary-600 dark:text-primary-400 underline hover:text-primary-800 dark:hover:text-primary-300"
        target="_blank"
        rel="noopener noreferrer"
      >openbankproject.com</a>.
    </p>

    <h2 class="h3 pt-4" data-testid="useful-links-title">Useful Links</h2>

    <ul class="list-disc space-y-2 pl-5">
      <li>
        <a href="/site-map" class="text-primary-600 dark:text-primary-400 underline hover:text-primary-800 dark:hover:text-primary-300" data-testid="link-site-map">
          Site Map
        </a>
        — view all pages and the roles required to access them
      </li>
      <li>
        <a href="/status" class="text-primary-600 dark:text-primary-400 underline hover:text-primary-800 dark:hover:text-primary-300" data-testid="link-status">
          Status
        </a>
        — check the health of the API
      </li>
      <li>
        <a
          href="https://github.com/OpenBankProject"
          class="text-primary-600 dark:text-primary-400 underline hover:text-primary-800 dark:hover:text-primary-300"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-github"
        >
          GitHub
        </a>
        — source code
      </li>
    </ul>

    <!-- Version Information Footer -->
    <div class="mt-12 border-t border-surface-200-800 pt-8" data-testid="build-info">
      <div class="text-sm text-surface-600-400">
        <span class="font-medium">Version:</span>
        <span class="font-mono text-surface-900-100" data-testid="build-version">{__APP_VERSION__}</span>
        {#if __GIT_COMMIT__ !== 'unknown'}
          <span class="mx-2">•</span>
          <span class="font-medium">Commit:</span>
          <span class="font-mono text-surface-900-100" data-testid="build-commit">{__GIT_COMMIT__}</span>
        {/if}
        {#if __GIT_BRANCH__ !== 'unknown'}
          <span class="mx-2">•</span>
          <span class="font-medium">Branch:</span>
          <span class="font-mono text-surface-900-100" data-testid="build-branch">{__GIT_BRANCH__}</span>
        {/if}
        <span class="mx-2">•</span>
        <span class="font-medium">Built:</span>
        <span class="font-mono text-surface-900-100" data-testid="build-time">{formatBuildTime(__BUILD_TIME__)}</span>
      </div>
    </div>
  </div>
</div>
