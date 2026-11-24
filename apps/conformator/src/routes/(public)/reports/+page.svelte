<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { m } from '@obp/shared/i18n';
</script>

<h1 class="h2">{m.conformator_reports_title()}</h1>
<p class="mt-2 max-w-3xl">{m.conformator_reports_intro()}</p>
<form method="POST" action="?/find" class="mt-4 flex max-w-xl gap-2">
	<input class="input" name="reference" required maxlength="32" placeholder="CR-2026-..." aria-label={m.conformator_reports_reference()} />
	<button class="btn preset-filled">{m.conformator_reports_check()}</button>
</form>
<p class="mt-4 text-sm"><a class="anchor" href="/reports/signing-key">{m.conformator_reports_public_key_link()}</a></p>
