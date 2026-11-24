<!--
  Copyright (C) 2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details: <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { getLocale, LANGUAGE_NAMES, locales, m, setLocale, textDirection } from '$shared/i18n';

	/** One button per other language, named in that language; choosing one remembers it in a cookie and reloads the page in it. */
	const others = locales.filter((locale) => locale !== getLocale());
</script>

{#each others as locale (locale)}
	<button
		type="button"
		class="btn preset-tonal"
		lang={locale}
		dir={textDirection(locale)}
		title={m.language_switch_label()}
		data-testid="language-{locale}"
		onclick={() => setLocale(locale)}>{LANGUAGE_NAMES[locale]}</button
	>
{/each}
