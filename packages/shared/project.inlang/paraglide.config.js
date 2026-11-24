/*
 * Copyright (C) 2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Translations for every OBP-Frontend app. `npm run prepare` in packages/shared compiles messages/*.json into src/lib/paraglide, which the apps import as $shared/paraglide/...
import { defineConfig } from '@inlang/paraglide-js';

export default defineConfig({
	// The language a visitor chose with the language switch (a cookie), else their browser's language, else English
	strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
	// Type declarations, so svelte-check knows each message and its parameters
	emitTsDeclarations: true
});
