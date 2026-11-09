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
import { t, type Locale, type MessageKey } from '$lib/i18n';

/**
 * A programme's stages, in order, and the gate before each. Every startup starts onboarded, when its application is
 * accepted; the stages after that are the programme's own, set by staff on the programme, and the last is always
 * graduated, which gives the certificate. A gate is a condition on the startup's records: its company registered,
 * milestones accepted, sessions attended. Staff move a startup on; Cohort checks the gate again when they do.
 * A programme that sets no stages has the default: start the programme once the company is registered, graduate once
 * every milestone is accepted.
 */

export const FIRST_STAGE = 'onboarded';
export const LAST_STAGE = 'graduated';

export interface Gate {
	/** The startup's company is registered. */
	company: boolean;
	/** Milestones accepted: none needed, all of the programme's, or at least this many. */
	milestones: 'none' | 'all' | number;
	/** Sessions attended, at least; 0 for none. */
	sessions: number;
}

export interface StageDef {
	key: string;
	/** The stage's name in English and Arabic; empty for the built-in stages, which are named by Cohort. */
	name: string;
	name_ar: string;
	gate: Gate;
}

export const DEFAULT_STAGES: StageDef[] = [
	{ key: 'in_programme', name: '', name_ar: '', gate: { company: true, milestones: 'none', sessions: 0 } },
	{ key: LAST_STAGE, name: '', name_ar: '', gate: { company: false, milestones: 'all', sessions: 0 } }
];

const BUILT_IN = [FIRST_STAGE, 'in_programme', LAST_STAGE];

function gateOf(raw: unknown): Gate {
	const g = (raw ?? {}) as Record<string, unknown>;
	const n = Number(g.milestones);
	const sessions = Number(g.sessions);
	return {
		company: g.company === true,
		milestones: g.milestones === 'all' ? 'all' : Number.isInteger(n) && n > 0 ? n : 'none',
		sessions: Number.isInteger(sessions) && sessions > 0 ? sessions : 0
	};
}

/** A key for a new stage from its name: lower case letters, digits and _, not one already taken. */
export function stageKeyFor(name: string, taken: string[]): string {
	const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'stage';
	let key = base;
	for (let i = 2; taken.includes(key) || key === FIRST_STAGE; i++) key = `${base}_${i}`;
	return key;
}

/**
 * The stages from their JSON, as staff saved them: unreadable entries are left out, a stage keeps its saved key (a new
 * one, or a duplicate, gets one from its name), and the list always ends with graduated. Anything unreadable gives the default stages.
 */
export function parseStages(json: unknown): StageDef[] {
	let raw: unknown;
	try {
		raw = typeof json === 'string' ? JSON.parse(json) : json;
	} catch {
		return DEFAULT_STAGES;
	}
	if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_STAGES;
	const stages: StageDef[] = [];
	for (const entry of raw as Record<string, unknown>[]) {
		const name = String(entry?.name ?? '').trim().slice(0, 100);
		const name_ar = String(entry?.name_ar ?? '').trim().slice(0, 100);
		const given = String(entry?.key ?? '');
		const taken = stages.map((s) => s.key);
		// A stage keeps the key it was saved with, so renaming it leaves its participants at it; only a new stage gets one.
		const keep = /^[a-z0-9_]{1,40}$/.test(given) && given !== FIRST_STAGE && !taken.includes(given);
		const key = given === LAST_STAGE || keep ? given : stageKeyFor(name || given, taken);
		if (key === LAST_STAGE && taken.includes(LAST_STAGE)) continue;
		if (key !== LAST_STAGE && !BUILT_IN.includes(key) && !name && !name_ar) continue;
		stages.push({ key, name, name_ar, gate: gateOf(entry?.gate) });
	}
	const last = stages.findIndex((s) => s.key === LAST_STAGE);
	const graduated = last >= 0 ? stages.splice(last, 1)[0] : DEFAULT_STAGES[DEFAULT_STAGES.length - 1];
	return [...stages, graduated];
}

/** A cohort_programme record's stages. */
export const stagesOf = (programme: Record<string, unknown> | null | undefined) => parseStages(programme?.stages ?? '');

export interface GateInput {
	stage: string;
	company_registered: boolean;
	milestones_accepted: number;
	milestones_total: number;
	sessions_attended?: number;
}

export type Missing = { kind: 'company' } | { kind: 'milestones'; need: number | 'all' } | { kind: 'sessions'; need: number };

export interface NextStage {
	/** The stage it would move to, or null at the last one (or at a stage the programme no longer has). */
	to: string | null;
	/** What is still missing for the gate; empty when it may move on. */
	missing: Missing[];
}

export function nextStage(p: GateInput, stages: StageDef[] = DEFAULT_STAGES): NextStage {
	const order = [FIRST_STAGE, ...stages.map((s) => s.key)];
	const at = order.indexOf(p.stage);
	if (at < 0 || at === order.length - 1) return { to: null, missing: [] };
	const next = stages[at];
	const missing: Missing[] = [];
	if (next.gate.company && !p.company_registered) missing.push({ kind: 'company' });
	const milestones = next.gate.milestones;
	if (milestones === 'all' ? p.milestones_accepted < p.milestones_total : milestones !== 'none' && p.milestones_accepted < milestones)
		missing.push({ kind: 'milestones', need: milestones as number | 'all' });
	if (next.gate.sessions > 0 && (p.sessions_attended ?? 0) < next.gate.sessions) missing.push({ kind: 'sessions', need: next.gate.sessions });
	return { to: next.key, missing };
}

/** A stage's name in the reader's language: Cohort's own for the built-in stages, staff's for the others. */
export function stageName(locale: Locale, key: string, stages: StageDef[] = DEFAULT_STAGES): string {
	const def = stages.find((s) => s.key === key);
	const own = locale === 'ar' ? def?.name_ar || def?.name : def?.name || def?.name_ar;
	if (own) return own;
	return BUILT_IN.includes(key) ? t(locale, `participant_stage_${key}` as MessageKey) : key;
}

/** What a gate still needs, in words. */
export function missingText(locale: Locale, m: Missing): string {
	if (m.kind === 'company') return t(locale, 'stage_missing_company');
	if (m.kind === 'sessions') return `${t(locale, 'stage_missing_sessions')} ${m.need}`;
	return m.need === 'all' ? t(locale, 'stage_missing_milestones') : `${t(locale, 'stage_missing_milestones_n')} ${m.need}`;
}
