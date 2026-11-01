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
import { t, LOCALES, type MessageKey } from '$lib/i18n';

/**
 * The emails Cohort sends applicants, in every locale at once (English, then Arabic): Cohort does not know which
 * language a recipient reads. Plain text, so nothing in them is ever rendered as HTML.
 */
export interface Email {
	subject: string;
	text: string;
}

/** Replaces {name} placeholders in a message. */
export function fill(template: string, values: Record<string, string>): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function inEveryLocale(subjectKey: MessageKey, bodyKeys: MessageKey[], values: Record<string, string>): Email {
	return {
		// One line, as OBP-API requires: the English subject, then the Arabic one.
		subject: LOCALES.map((l) => fill(t(l, subjectKey), values)).join(' | ').replace(/[\r\n]+/g, ' '),
		text: LOCALES.map((l) =>
			bodyKeys
				.map((k) => fill(t(l, k), values))
				.filter((line) => line.trim() !== '')
				.join('\n\n')
		).join('\n\n----------\n\n')
	};
}

export interface ApplicationEmailValues {
	/** The installation's name, e.g. "Cohort". */
	site: string;
	call: string;
	startup: string;
	/** The applicant's page for the application. */
	link: string;
}

export function submittedEmail(v: ApplicationEmailValues): Email {
	return inEveryLocale('email_submitted_subject', ['email_greeting', 'email_submitted_body', 'email_link', 'email_signoff'], { ...v });
}

/** The decision and the message written for the applicant; never the internal reason. */
export function decisionEmail(v: ApplicationEmailValues & { decision: string; message: string }): Email {
	const values = (locale: (typeof LOCALES)[number]) => ({
		...v,
		outcome: t(locale, `decision_${v.decision}` as MessageKey)
	});
	return {
		subject: LOCALES.map((l) => fill(t(l, 'email_decision_subject'), values(l))).join(' | ').replace(/[\r\n]+/g, ' '),
		text: LOCALES.map((l) =>
			[
				fill(t(l, 'email_greeting'), values(l)),
				fill(t(l, 'email_decision_body'), values(l)),
				v.message,
				fill(t(l, 'email_link'), values(l)),
				fill(t(l, 'email_signoff'), values(l))
			]
				.filter((line) => line.trim() !== '')
				.join('\n\n')
		).join('\n\n----------\n\n')
	};
}
