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
import { env } from '$env/dynamic/private';

/** The space holding Cohort's records: a bank id, or SYS for the system space. One per installation. */
export function cohortSpace(): string {
	return env.OBP_ENTITY_SPACE_ID?.trim() || 'cohort';
}

/**
 * The space holding the dynamic entities of published forms and their answers, apart from Cohort's own records, so
 * the Roles that create and change dynamic entity definitions there reach nothing in Cohort's space. Answers refer
 * to applications and participants in Cohort's space by id; nothing in Cohort's space refers here but the form record.
 */
export function cohortFormsSpace(): string {
	return env.COHORT_FORMS_SPACE_ID?.trim() || `${cohortSpace()}-forms`;
}
