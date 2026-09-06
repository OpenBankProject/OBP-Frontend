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
    import { getContext } from 'svelte';

    const ctx: any = getContext('developerContext');

    const sdks = [
        { name: 'Python', folder: 'python', registry: 'PyPI', installCmd: 'pip install obp-python' },
        { name: 'TypeScript', folder: 'typescript', registry: 'npm', installCmd: 'npm install obp-typescript' },
        { name: 'Java', folder: 'java', registry: 'Maven Central', installCmd: null },
        { name: 'Kotlin', folder: 'kotlin', registry: 'Maven Central', installCmd: null },
        { name: 'Scala', folder: 'scala', registry: 'Maven Central', installCmd: null },
        { name: 'C#', folder: 'csharp', registry: 'NuGet', installCmd: 'dotnet add package obp-csharp' },
        { name: 'Go', folder: 'golang', registry: 'Go modules', installCmd: null },
        { name: 'Rust', folder: 'rust', registry: 'crates.io', installCmd: 'cargo add obp-rust' },
        { name: 'Swift', folder: 'swift', registry: 'Swift PM', installCmd: null },
        { name: 'PHP', folder: 'php', registry: 'Packagist', installCmd: 'composer require openbankproject/obp-php' },
        { name: 'Ruby', folder: 'ruby', registry: 'RubyGems', installCmd: 'gem install obp-ruby' },
        { name: 'Dart', folder: 'dart', registry: 'pub.dev', installCmd: 'dart pub add obp_dart' },
    ];
</script>

<svelte:head>
    <title>SDKs - OBP Developers</title>
</svelte:head>

<div class="prose prose-lg max-w-none dark:prose-invert">
    <h2>OBP Client SDKs</h2>

    <p>
        The Open Bank Project provides auto-generated client SDKs for a wide range of programming
        languages. These SDKs are produced from the OBP
        <a href="https://en.wikipedia.org/wiki/OpenAPI_Specification" target="_blank" rel="noopener noreferrer">OpenAPI 3.1 specification</a>,
        ensuring they stay synchronised with the latest API endpoints and data models.
    </p>

    <p>
        All SDKs are available in the
        <a href="https://github.com/OpenBankProject/OBP-SDKs" target="_blank" rel="noopener noreferrer" data-testid="sdk-repo-link">OBP-SDKs</a>
        repository on GitHub.
    </p>

    <h3>Available SDKs</h3>

    <div class="not-prose">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each sdks as sdk}
                <a
                    href="https://github.com/OpenBankProject/OBP-SDKs/tree/main/{sdk.folder}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block rounded-lg border border-surface-300-600 p-4 hover:border-primary-500 hover:bg-surface-100-800 transition-colors no-underline"
                    data-testid="sdk-card-{sdk.folder}"
                >
                    <div class="font-semibold text-lg text-surface-900-50">{sdk.name}</div>
                    <div class="text-sm text-surface-600-400 mt-1">{sdk.registry}</div>
                </a>
            {/each}
        </div>
    </div>

    <h3>How It Works</h3>

    <p>
        The SDKs are generated using
        <a href="https://openapi-generator.tech" target="_blank" rel="noopener noreferrer">OpenAPI Generator</a>
        from the OBP API's OpenAPI 3.1 specification. This means:
    </p>

    <ul>
        <li><strong>Full API coverage</strong> &mdash; every endpoint is available as a typed method</li>
        <li><strong>Up-to-date models</strong> &mdash; request and response types match the live API</li>
        <li><strong>Idiomatic code</strong> &mdash; each SDK follows the conventions of its language</li>
    </ul>

    <h3>Getting Started</h3>

    <p>
        Pick the SDK for your language and follow the installation and authentication instructions in its
        <a href="https://github.com/OpenBankProject/OBP-SDKs" target="_blank" rel="noopener noreferrer">README</a>.
    </p>

</div>
