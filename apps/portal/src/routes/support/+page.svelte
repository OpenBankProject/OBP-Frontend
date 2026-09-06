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
	import { LifeBuoy, MessageCircle, ExternalLink } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Support</title>
</svelte:head>

<div class="flex flex-col h-full w-full items-center justify-center">
	<div class="mx-auto p-5">
		<LifeBuoy size={100} color="var(--color-primary-200)" />
	</div>
	<div class="text-center mt-6 max-w-xl">
		<h1 class="text-2xl font-bold mb-4">Need a hand?</h1>
		<p class="text-gray-500 mb-8">
			Reach the team on our internal chat, or contact the support platform.
		</p>
		<div class="flex flex-col sm:flex-row justify-center gap-4">
			<a href="/user/chat" class="btn btn-primary" data-testid="support-internal-chat">
				<MessageCircle size={18} />
				<span>Team Chat</span>
			</a>
			<a
				href={data.supportPlatformUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="btn btn-secondary"
				data-testid="support-platform-link"
			>
				<span>Support Platform</span>
				<ExternalLink size={18} />
			</a>
		</div>
	</div>
</div>
