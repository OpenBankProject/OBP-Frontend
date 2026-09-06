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
import FAQ from "$lib/data/developerFaqEntity.json";
import { recordsFromListResponse, unwrapRecord } from "$lib/server/dynamicEntities/ensure";

export const FAQ_ENTITY = FAQ.entity_name; // "obp_developer_faq"
export const FAQ_DATA_PATH = `/obp/dynamic-entity/${FAQ_ENTITY}`;
export const FAQ_ID_FIELD = `${FAQ_ENTITY}_id`;

export interface FaqRecord {
  id: string;
  question: string;
  answer: string;
  opey_prompt: string;
  category: string;
  sort_order: number;
  chat_room_id: string;
  chat_joining_key: string;
}

export function toFaqRecord(input: any): FaqRecord {
  const raw = unwrapRecord(FAQ_ENTITY, input);
  return {
    id: String(raw?.[FAQ_ID_FIELD] ?? raw?.id ?? ""),
    question: String(raw?.question ?? ""),
    answer: String(raw?.answer ?? ""),
    opey_prompt: String(raw?.opey_prompt ?? ""),
    category: String(raw?.category ?? ""),
    sort_order: Number.isFinite(Number(raw?.sort_order)) ? Number(raw.sort_order) : 0,
    chat_room_id: String(raw?.chat_room_id ?? ""),
    chat_joining_key: String(raw?.chat_joining_key ?? ""),
  };
}

export { recordsFromListResponse };

/** The record body OBP stores, from a FaqRecord-like object. */
export function toFaqBody(r: Partial<FaqRecord>): Record<string, unknown> {
  return {
    question: String(r.question ?? "").trim(),
    answer: String(r.answer ?? ""),
    opey_prompt: String(r.opey_prompt ?? "").trim(),
    category: String(r.category ?? "").trim(),
    sort_order: Number.isFinite(Number(r.sort_order)) ? Math.trunc(Number(r.sort_order)) : 0,
    chat_room_id: String(r.chat_room_id ?? "").trim(),
    chat_joining_key: String(r.chat_joining_key ?? "").trim(),
  };
}

export function validateFaqBody(body: Record<string, unknown>): string {
  if (!String(body.question ?? "").trim()) return "question is required";
  if (!String(body.answer ?? "").trim()) return "answer is required";
  return "";
}
