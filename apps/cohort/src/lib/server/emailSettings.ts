/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { emailSettingsOf, type EmailSettings } from '$lib/emailSettings';
import { EMAIL_SETTING } from './entities/definitions';
import { idOf, listRecords } from './records';

/**
 * The email settings record, read publicly (it holds only switches and days), so Cohort's own reminder timer reads it
 * without a Role. The first record is the one; none means the defaults.
 */
export async function emailSettingsRecord(): Promise<{ id: string | null; settings: EmailSettings }> {
	const records = await listRecords(EMAIL_SETTING, 'public').catch(() => []);
	const first = records[0];
	return { id: first ? idOf(EMAIL_SETTING, first) : null, settings: emailSettingsOf(first) };
}

export const emailSettings = async () => (await emailSettingsRecord()).settings;
