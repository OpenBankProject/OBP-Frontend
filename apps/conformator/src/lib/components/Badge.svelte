<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
  Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
  any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details:
  <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	/** A short word in a coloured box: a status, an outcome or a stage. */
	let { value, tone = 'surface' }: { value: string; tone?: 'surface' | 'success' | 'warning' | 'error' | 'primary' } = $props();
	const classes: Record<string, string> = {
		surface: 'preset-tonal-surface',
		success: 'preset-tonal-success',
		warning: 'preset-tonal-warning',
		error: 'preset-tonal-error',
		primary: 'preset-tonal-primary'
	};
</script>

<span class="badge {classes[tone]}">{value.replaceAll('_', ' ')}</span>
