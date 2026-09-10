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
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/obp/requests", () => ({
  obp_requests: { instance: { base_url: "https://obp.example" } },
}));

const { excerptFromMarkdown, loadGlossaryIndex, loadGlossaryEntry, searchGlossary } = await import(
  "./apiGlossaryCache"
);

/** Two static entries and one Dynamic one overriding a static title, as v7 reports them. */
const ITEMS = [
  {
    title: "Bank",
    description: { markdown: "# Bank\n\nA **bank** on this instance. See [accounts](/glossary#Bank-Account).", html: "" },
    is_dynamic: false,
    overrides_static_item: false,
  },
  {
    title: "Bank Account",
    description: { markdown: "An account held at a [Bank](/glossary#Bank).\n\n```json\n{\"id\": 1}\n```", html: "" },
    is_dynamic: false,
    overrides_static_item: false,
  },
  {
    title: "Consent",
    description: { markdown: "Our own wording for consent. Unrelated: [the glossary](/glossary) and [a gap](/glossary#Not-A-Term).", html: "" },
    is_dynamic: true,
    overrides_static_item: true,
  },
];

function mockGlossaryResponse(items = ITEMS, etag: string | null = null) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name.toLowerCase() === "etag" ? etag : null) },
    json: async () => ({ glossary_items: items }),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

/** Put `items` in the cache, bypassing any revalidation window. */
async function seed(items = ITEMS, etag: string | null = null) {
  vi.stubGlobal("fetch", mockGlossaryResponse(items, etag));
  await loadGlossaryIndex("token", true);
}

describe("excerptFromMarkdown", () => {
  it("reduces markdown to one line of plain text", () => {
    expect(excerptFromMarkdown("# Title\n\nSome **bold** and `code` text.")).toBe("Title Some bold and code text.");
  });

  it("keeps link text and drops the target", () => {
    expect(excerptFromMarkdown("See [the bank](/glossary#Bank) for more.")).toBe("See the bank for more.");
  });

  it("drops fenced code blocks", () => {
    expect(excerptFromMarkdown("Before\n\n```scala\nval x = 1\n```\n\nAfter")).toBe("Before After");
  });

  it("truncates on a word boundary", () => {
    const excerpt = excerptFromMarkdown("alpha beta gamma delta epsilon", 12);
    expect(excerpt).toBe("alpha beta…");
  });
});

describe("loadGlossaryIndex", () => {
  it("returns every entry sorted by title, with provenance and an excerpt", async () => {
    vi.stubGlobal("fetch", mockGlossaryResponse());
    const { rows } = await loadGlossaryIndex("token", true);
    expect(rows.map((r) => r.title)).toEqual(["Bank", "Bank Account", "Consent"]);
    expect(rows[2]).toMatchObject({ title: "Consent", is_dynamic: true, overrides_static_item: true });
    expect(rows[0].excerpt).toContain("A bank on this instance");
  });
});

describe("duplicate and case-variant titles", () => {
  // A keyed {#each} over the index would throw each_key_duplicate and unmount the page,
  // so the index must hold one row per exact title.
  it("lists a repeated title once and reports it", async () => {
    const items = [
      ITEMS[0],
      { ...ITEMS[0], description: { markdown: "A second declaration of the same title.", html: "" } },
      ITEMS[1],
    ];
    vi.stubGlobal("fetch", mockGlossaryResponse(items));
    const { rows, duplicateTitles } = await loadGlossaryIndex("token", true);
    expect(rows.map((r) => r.title)).toEqual(["Bank", "Bank Account"]);
    expect(duplicateTitles).toEqual(["Bank"]);
    expect(new Set(rows.map((r) => r.title)).size).toBe(rows.length);
  });

  it("keeps titles that differ only in case as separate entries", async () => {
    const items = [
      ITEMS[0],
      { ...ITEMS[0], title: "bank", description: { markdown: "The lowercase field, not the concept.", html: "" } },
    ];
    vi.stubGlobal("fetch", mockGlossaryResponse(items));
    const { rows, duplicateTitles } = await loadGlossaryIndex("token", true);
    expect(rows).toHaveLength(2);
    expect(duplicateTitles).toEqual([]);
    // An exact match must win, or both URLs resolve to the same entry.
    expect((await loadGlossaryEntry("token", "bank"))?.markdown).toContain("lowercase field");
    expect((await loadGlossaryEntry("token", "Bank"))?.markdown).toContain("A **bank** on this instance");
  });
});

describe("loadGlossaryEntry", () => {
  it("matches the title case insensitively", async () => {
    vi.stubGlobal("fetch", mockGlossaryResponse());
    const entry = await loadGlossaryEntry("token", "bank account", true);
    expect(entry?.title).toBe("Bank Account");
  });

  it("is undefined for a title the Glossary does not have", async () => {
    vi.stubGlobal("fetch", mockGlossaryResponse());
    expect(await loadGlossaryEntry("token", "No Such Term", true)).toBeUndefined();
  });

  it("points a dashed in-glossary anchor at the entry's own page", async () => {
    vi.stubGlobal("fetch", mockGlossaryResponse());
    const entry = await loadGlossaryEntry("token", "Bank", true);
    // "/glossary#Bank-Account" is the anchor form of the title "Bank Account".
    expect(entry?.html).toContain('href="/glossary/Bank%20Account"');
  });

  it("sends an anchor with no matching entry to the API Explorer instead of a dead link", async () => {
    vi.stubGlobal("fetch", mockGlossaryResponse());
    const entry = await loadGlossaryEntry("token", "Consent", true);
    expect(entry?.html).toContain("/glossary#Not-A-Term");
    expect(entry?.html).toMatch(/href="https?:\/\/[^"]*\/glossary#Not-A-Term"/);
    // A bare /glossary link stays on the index.
    expect(entry?.html).toContain('href="/glossary"');
  });

  it("escapes raw HTML in the markdown rather than rendering it", async () => {
    const items = [
      { ...ITEMS[0], description: { markdown: 'Careful: <img src=x onerror="alert(1)">', html: "" } },
    ];
    vi.stubGlobal("fetch", mockGlossaryResponse(items));
    const entry = await loadGlossaryEntry("token", "Bank", true);
    // The tag survives as inert text, so "onerror" is still in the string — what matters is
    // that it is escaped and never reaches the browser as an element.
    expect(entry?.html).toContain("&lt;img");
    expect(entry?.html).not.toContain("<img");
  });
});

describe("searchGlossary", () => {
  it("matches on description text, not only titles", async () => {
    await seed();
    expect(await searchGlossary("token", "our own wording")).toEqual(new Set(["Consent"]));
  });

  it("requires every term to appear, anywhere in the entry", async () => {
    await seed();
    // "Bank" matches too: its body links to [accounts](/glossary#Bank-Account).
    expect(await searchGlossary("token", "bank account")).toEqual(new Set(["Bank", "Bank Account"]));
    // "held" only appears in Bank Account, so adding it narrows the result.
    expect(await searchGlossary("token", "bank held")).toEqual(new Set(["Bank Account"]));
  });
});

describe("ETag revalidation", () => {
  it("reuses the cached items on a 304", async () => {
    await seed(ITEMS, '"v1"');

    const revalidate = vi.fn(async () => ({
      ok: false,
      status: 304,
      headers: { get: () => null },
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", revalidate);
    const { rows } = await loadGlossaryIndex("token");
    expect(rows).toHaveLength(3);
    const headers = (revalidate as any).mock.calls[0][1].headers;
    expect(headers["If-None-Match"]).toBe('"v1"');
  });
});
