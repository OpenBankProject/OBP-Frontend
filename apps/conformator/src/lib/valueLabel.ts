/*
 * Copyright (C) 2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU Affero General Public License for details: <https://www.gnu.org/licenses/>.
 */
import { m } from '@obp/shared/i18n';

// The messages by name, so a stored value can find its label
const messages = m as unknown as Record<string, ((inputs?: Record<string, never>) => string) | undefined>;

/**
 * The words stored in records, such as an outcome (not_executed) or a system role (api_provider), as the page's language says them.
 * Each has a message conformator_value_<value>; a value without one is shown with spaces for underscores, as before.
 */
export function valueLabel(value: string): string {
	const message = messages[`conformator_value_${value}`];
	return message ? message() : value.replaceAll('_', ' ');
}
