<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<h1 class="h2">Check a conformance report</h1>
<p class="mt-2 max-w-3xl">Give the reference printed on the report, such as CR-2026-7K3QX9MD. You will see whether it is genuine, unchanged and still valid.</p>
<form method="POST" action="?/find" class="mt-4 flex max-w-xl gap-2">
	<input class="input" name="reference" required maxlength="32" placeholder="CR-2026-..." aria-label="Report reference" />
	<button class="btn preset-filled">Check</button>
</form>
<p class="mt-4 text-sm"><a class="anchor" href="/reports/signing-key">The public key reports are signed with</a></p>
