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
  // Shared by every OBP-Frontend app: packages/shared/src/lib/components/MissingRoleAlert.svelte. The API Manager's
  // wiring (the chosen bank, which Roles need one) is set in its root layout with setRoleRequests.
  import type { ComponentProps } from "svelte";
  import { MissingRoleAlert } from "@obp/shared/components";
  let props: ComponentProps<typeof MissingRoleAlert> = $props();
</script>

<MissingRoleAlert {...props} />
