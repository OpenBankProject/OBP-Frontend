<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
  import { scaleBand, scaleLinear, scalePoint } from "d3";
  import { chartData, type ReportChartSpec, type ReportResult } from "$lib/services/reports";

  /**
   * Draws one declarative chart from a report result: bar, stacked bar or line, inline SVG.
   * The report supplies data and a spec; all drawing lives here, so no charting code runs
   * inside the report sandbox. One value axis, thin marks, legend for two or more series,
   * a hover tooltip, and the table below the chart as the always-available fallback.
   */
  let { spec, result, index = 0 }: { spec: ReportChartSpec; result: ReportResult; index?: number } = $props();

  const data = $derived(chartData(result, spec));
  const type = $derived(spec.type === "line" || spec.type === "stacked-bar" || spec.type === "pie" ? spec.type : "bar");
  const horizontal = $derived(type !== "line" && type !== "pie" && (spec.horizontal ?? data.categories.length > 8));

  // Donut geometry: slices with a 2px surface gap, percent labels on slices of 5% or more,
  // the total in the middle, and the legend (always, since every slice is its own identity).
  const DONUT_R = 110;
  const DONUT_INNER = 66;
  const donut = $derived.by(() => {
    if (type !== "pie" || !data.series[0]) return [] as { name: string; value: number; pct: number; path: string; lx: number; ly: number }[];
    const values = data.series[0].values.map((v) => v ?? 0);
    const total = values.reduce((a, b) => a + b, 0) || 1;
    let angle = -Math.PI / 2;
    const gap = 2 / DONUT_R; // ~2px gap at the outer edge
    return values.map((v, i) => {
      const sweep = (v / total) * Math.PI * 2;
      const a0 = angle + (values.length > 1 ? gap / 2 : 0);
      const a1 = angle + sweep - (values.length > 1 ? gap / 2 : 0);
      angle += sweep;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
      const path = a1 <= a0 ? "" : `M${p(DONUT_R, a0)} A${DONUT_R},${DONUT_R} 0 ${large} 1 ${p(DONUT_R, a1)} L${p(DONUT_INNER, a1)} A${DONUT_INNER},${DONUT_INNER} 0 ${large} 0 ${p(DONUT_INNER, a0)} Z`;
      const mid = (a0 + a1) / 2;
      const lr = (DONUT_R + DONUT_INNER) / 2;
      return { name: data.categories[i], value: v, pct: v / total, path, lx: lr * Math.cos(mid), ly: lr * Math.sin(mid) };
    });
  });
  const donutTotal = $derived(type === "pie" && data.series[0] ? data.series[0].values.reduce<number>((a, b) => a + (b ?? 0), 0) : 0);
  const pct = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 0 });

  // Geometry
  const W = 720;
  const H = $derived(horizontal ? Math.max(180, 36 + data.categories.length * 28) : 300);
  const M = $derived({ top: 16, right: 24, bottom: horizontal ? 36 : 56, left: horizontal ? 140 : 64 });
  const innerW = $derived(W - M.left - M.right);
  const innerH = $derived(H - M.top - M.bottom);

  const stacked = $derived(type === "stacked-bar");
  // Totals per category for stacked bars; otherwise the max single value.
  const valueMax = $derived.by(() => {
    if (stacked) {
      return Math.max(0, ...data.categories.map((_, i) => data.series.reduce((sum, s) => sum + Math.max(0, s.values[i] ?? 0), 0)));
    }
    return Math.max(0, ...data.series.flatMap((s) => s.values.map((v) => v ?? 0)));
  });
  const valueMin = $derived(Math.min(0, ...data.series.flatMap((s) => s.values.map((v) => v ?? 0))));
  const value = $derived(scaleLinear().domain([valueMin, valueMax || 1]).nice().range(horizontal ? [0, innerW] : [innerH, 0]));
  const band = $derived(scaleBand<string>().domain(data.categories.map((_, i) => String(i))).range([0, horizontal ? innerH : innerW]).paddingInner(0.25).paddingOuter(0.15));
  const point = $derived(scalePoint<string>().domain(data.categories.map((_, i) => String(i))).range([0, innerW]).padding(0.5));

  const MAX_BAR = 24;
  const GAP = 2; // surface gap between touching marks
  const groupCount = $derived(stacked ? 1 : data.series.length);
  const barThickness = $derived(Math.min(MAX_BAR, (band.bandwidth() - GAP * (groupCount - 1)) / groupCount));
  const groupWidth = $derived(barThickness * groupCount + GAP * (groupCount - 1));
  const ticks = $derived(value.ticks(horizontal ? 6 : 5));

  const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const fmtCompact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

  // Direct label: only the largest value of the first series (selective, never every point).
  const peak = $derived.by(() => {
    const s = data.series[0];
    if (!s) return -1;
    let best = -1;
    s.values.forEach((v, i) => { if (v !== null && (best < 0 || v > (s.values[best] ?? -Infinity))) best = i; });
    return best;
  });

  // Hover
  let hover = $state<{ ci: number; si: number } | null>(null);
  function tooltipText(ci: number, si: number): string {
    const s = data.series[si];
    const v = s?.values[ci];
    return `${data.categories[ci]} · ${s?.name}: ${v === null || v === undefined ? "—" : fmt.format(v)}`;
  }

  function stackOffset(ci: number, si: number): number {
    let acc = 0;
    for (let k = 0; k < si; k++) acc += Math.max(0, data.series[k].values[ci] ?? 0);
    return acc;
  }

  function linePath(values: (number | null)[]): string {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      const x = point(String(i)) ?? 0;
      const y = value(v);
      d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  function truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  const chartId = $derived(`report-chart-${index}`);
</script>

<figure class="viz-root" data-testid={chartId} data-chart-type={type}>
  {#if spec.title}<figcaption class="viz-title">{spec.title}</figcaption>{/if}

  {#if data.problem && data.series.length === 0}
    <p class="viz-problem" data-testid="{chartId}-problem">Chart not drawn: {data.problem}.</p>
  {:else}
    {#if type === "pie"}
      <div class="viz-donut" data-testid="{chartId}-donut">
        <svg viewBox="-{DONUT_R + 8} -{DONUT_R + 8} {(DONUT_R + 8) * 2} {(DONUT_R + 8) * 2}" class="viz-donut-svg" role="img" aria-label={spec.title ?? `share of ${data.series[0]?.name} by ${spec.x}`} onmouseleave={() => (hover = null)}>
          {#each donut as sl, i (sl.name)}
            <path d={sl.path} class="viz-bar" class:viz-bar-hover={hover?.ci === i} style="fill: var(--series-{i + 1})" onmouseenter={() => (hover = { ci: i, si: 0 })} role="presentation" />
            {#if sl.pct >= 0.05}
              <text x={sl.lx} y={sl.ly} class="viz-slice-label" text-anchor="middle" dominant-baseline="middle">{pct.format(sl.pct)}</text>
            {/if}
          {/each}
          <text x="0" y="-4" class="viz-total" text-anchor="middle">{fmtCompact.format(donutTotal)}</text>
          <text x="0" y="14" class="viz-tick" text-anchor="middle">{data.series[0]?.name}</text>
        </svg>
        <ul class="viz-legend viz-legend-col" aria-label="Slices">
          {#each donut as sl, i (sl.name)}
            <li class:viz-legend-hover={hover?.ci === i} onmouseenter={() => (hover = { ci: i, si: 0 })} onmouseleave={() => (hover = null)}>
              <span class="viz-swatch" style="background: var(--series-{i + 1})"></span>
              <span class="viz-legend-name">{sl.name}</span>
              <span class="viz-legend-value">{fmt.format(sl.value)} · {pct.format(sl.pct)}</span>
            </li>
          {/each}
        </ul>
      </div>
    {:else}
    {#if data.series.length >= 2}
      <ul class="viz-legend" aria-label="Series">
        {#each data.series as s, si (s.name)}
          <li><span class="viz-swatch" style="background: var(--series-{si + 1})"></span>{s.name}</li>
        {/each}
      </ul>
    {/if}

    <svg viewBox="0 0 {W} {H}" role="img" aria-label={spec.title ?? `${type} chart of ${data.series.map((s) => s.name).join(", ")} by ${spec.x}`} onmouseleave={() => (hover = null)}>
      <g transform="translate({M.left},{M.top})">
        <!-- gridlines + value ticks -->
        {#each ticks as t (t)}
          {#if horizontal}
            <line x1={value(t)} x2={value(t)} y1={0} y2={innerH} class="viz-grid" />
            <text x={value(t)} y={innerH + 16} class="viz-tick" text-anchor="middle">{fmtCompact.format(t)}</text>
          {:else}
            <line x1={0} x2={innerW} y1={value(t)} y2={value(t)} class="viz-grid" />
            <text x={-8} y={value(t)} class="viz-tick" text-anchor="end" dominant-baseline="middle">{fmtCompact.format(t)}</text>
          {/if}
        {/each}
        <!-- baseline -->
        {#if horizontal}
          <line x1={value(0)} x2={value(0)} y1={0} y2={innerH} class="viz-axis" />
        {:else}
          <line x1={0} x2={innerW} y1={value(0)} y2={value(0)} class="viz-axis" />
        {/if}

        <!-- category labels -->
        {#each data.categories as c, ci (ci)}
          {#if horizontal}
            <text x={-8} y={(band(String(ci)) ?? 0) + band.bandwidth() / 2} class="viz-cat" text-anchor="end" dominant-baseline="middle">{truncate(c, 22)}</text>
          {:else if type === "line"}
            {#if data.categories.length <= 12 || ci % Math.ceil(data.categories.length / 12) === 0}
              <text x={point(String(ci))} y={innerH + 18} class="viz-cat" text-anchor="middle">{truncate(c, 12)}</text>
            {/if}
          {:else}
            {#if data.categories.length <= 12 || ci % Math.ceil(data.categories.length / 12) === 0}
              <text x={(band(String(ci)) ?? 0) + band.bandwidth() / 2} y={innerH + 18} class="viz-cat" text-anchor="middle">{truncate(c, 12)}</text>
            {/if}
          {/if}
        {/each}

        <!-- marks -->
        {#if type === "line"}
          {#each data.series as s, si (s.name)}
            <path d={linePath(s.values)} class="viz-line" style="stroke: var(--series-{si + 1})" />
            {#each s.values as v, ci (ci)}
              {#if v !== null}
                <circle cx={point(String(ci))} cy={value(v)} r={hover?.ci === ci && hover?.si === si ? 6 : 4} class="viz-dot" style="fill: var(--series-{si + 1})" />
                <rect x={(point(String(ci)) ?? 0) - Math.max(8, point.step() / 2)} y={0} width={Math.max(16, point.step())} height={innerH} class="viz-hit" onmouseenter={() => (hover = { ci, si })} role="presentation" />
              {/if}
            {/each}
            {#if si === 0 && peak >= 0 && s.values[peak] !== null}
              <text x={point(String(peak))} y={value(s.values[peak] ?? 0) - 10} class="viz-label" text-anchor="middle">{fmt.format(s.values[peak] ?? 0)}</text>
            {/if}
          {/each}
        {:else}
          {#each data.categories as _, ci (ci)}
            {#each data.series as s, si (s.name)}
              {@const v = s.values[ci]}
              {#if v !== null}
                {@const off = stacked ? stackOffset(ci, si) : 0}
                {@const v0 = stacked ? off : Math.min(0, v)}
                {@const v1 = stacked ? off + Math.max(0, v) : Math.max(0, v)}
                {@const along = (band(String(ci)) ?? 0) + (band.bandwidth() - groupWidth) / 2 + (stacked ? 0 : si * (barThickness + GAP))}
                {@const len = Math.max(0, Math.abs(value(v1) - value(v0)) - (stacked && si > 0 ? GAP : 0))}
                {#if horizontal}
                  <rect
                    x={value(v0) + (stacked && si > 0 ? GAP : 0)} y={along} width={len} height={barThickness}
                    rx={stacked && si < data.series.length - 1 ? 0 : 4}
                    class="viz-bar" class:viz-bar-hover={hover?.ci === ci && hover?.si === si}
                    style="fill: var(--series-{si + 1})"
                    onmouseenter={() => (hover = { ci, si })} role="presentation"
                  />
                  {#if si === 0 && ci === peak && !stacked}
                    <text x={value(v1) + 6} y={along + barThickness / 2} class="viz-label" dominant-baseline="middle">{fmt.format(v ?? 0)}</text>
                  {/if}
                {:else}
                  <rect
                    x={along} y={value(v1)} width={barThickness} height={len}
                    rx={stacked && si < data.series.length - 1 ? 0 : 4}
                    class="viz-bar" class:viz-bar-hover={hover?.ci === ci && hover?.si === si}
                    style="fill: var(--series-{si + 1})"
                    onmouseenter={() => (hover = { ci, si })} role="presentation"
                  />
                  {#if si === 0 && ci === peak && !stacked}
                    <text x={along + barThickness / 2} y={value(v1) - 6} class="viz-label" text-anchor="middle">{fmt.format(v ?? 0)}</text>
                  {/if}
                {/if}
              {/if}
            {/each}
          {/each}
        {/if}

        <!-- value-axis label -->
        {#if spec.yLabel}
          {#if horizontal}
            <text x={innerW} y={innerH + 32} class="viz-tick" text-anchor="end">{spec.yLabel}</text>
          {:else}
            <text x={-8} y={-6} class="viz-tick" text-anchor="end">{spec.yLabel}</text>
          {/if}
        {/if}
      </g>
    </svg>
    {/if}

    <div class="viz-foot">
      <span class="viz-tooltip" aria-live="polite" data-testid="{chartId}-tooltip">{hover ? tooltipText(hover.ci, hover.si) : `${data.series.map((s) => s.name).join(", ")} by ${spec.x}. Hover a mark for its value.`}</span>
      {#if data.problem}<span class="viz-note">{data.problem}</span>{/if}
    </div>
  {/if}
</figure>

<style>
  /* Reference palette from the data-viz method, validated for both surfaces (2026-09-07). */
  .viz-root {
    --surface-1: #ffffff;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --text-muted: #6b7280;
    --grid: #e5e7eb;
    --axis: #c3c2b7;
    --series-1: #2a78d6;
    --series-2: #eb6834;
    --series-3: #1baf7a;
    --series-4: #eda100;
    --series-5: #e87ba4;
    --series-6: #008300;
    --series-7: #4a3aa7;
    --series-8: #e34948;
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  :global([data-mode="dark"]) .viz-root {
    --surface-1: #1f2937;
    --text-primary: #f9fafb;
    --text-secondary: #d1d5db;
    --text-muted: #9ca3af;
    --grid: #374151;
    --axis: #4b5563;
    --series-1: #3987e5;
    --series-2: #d95926;
    --series-3: #199e70;
    --series-4: #c98500;
    --series-5: #d55181;
    --series-6: #008300;
    --series-7: #9085e9;
    --series-8: #e66767;
  }
  .viz-title { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; }
  .viz-problem, .viz-note { font-size: 0.75rem; color: var(--text-muted); }
  .viz-legend { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; list-style: none; margin: 0 0 0.25rem; padding: 0; font-size: 0.75rem; color: var(--text-secondary); }
  .viz-legend li { display: inline-flex; align-items: center; gap: 0.375rem; }
  .viz-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
  svg { width: 100%; height: auto; display: block; background: var(--surface-1); border-radius: 6px; }
  .viz-grid { stroke: var(--grid); stroke-width: 1; }
  .viz-axis { stroke: var(--axis); stroke-width: 1; }
  .viz-tick, .viz-cat { font-size: 11px; fill: var(--text-muted); }
  .viz-label { font-size: 11px; font-weight: 600; fill: var(--text-primary); font-variant-numeric: tabular-nums; }
  .viz-bar { transition: opacity 120ms; }
  .viz-bar-hover { opacity: 0.85; }
  .viz-line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .viz-dot { stroke: var(--surface-1); stroke-width: 2; }
  .viz-hit { fill: transparent; }
  .viz-donut { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 1rem; align-items: center; }
  .viz-donut-svg { width: 240px; height: 240px; background: var(--surface-1); }
  .viz-slice-label { font-size: 11px; font-weight: 600; fill: #ffffff; paint-order: stroke; stroke: rgba(0, 0, 0, 0.35); stroke-width: 2px; }
  .viz-total { font-size: 22px; font-weight: 600; fill: var(--text-primary); }
  .viz-legend-col { flex-direction: column; gap: 0.25rem; }
  .viz-legend-col li { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 0.5rem; align-items: center; padding: 0.125rem 0.25rem; border-radius: 4px; }
  .viz-legend-hover { background: var(--grid); }
  .viz-legend-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); }
  .viz-legend-value { font-variant-numeric: tabular-nums; color: var(--text-secondary); }
  @media (max-width: 640px) { .viz-donut { grid-template-columns: 1fr; justify-items: center; } }
  .viz-foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem; margin-top: 0.25rem; font-size: 0.75rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
</style>
