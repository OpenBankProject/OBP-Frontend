/**
 * Landing page blocks: base styles.
 *
 * Neutral defaults for the expanded markup so a block looks reasonable with no
 * page CSS at all. Everything is driven by CSS custom properties, so a page
 * restyles the blocks by setting variables on its wrapper (or by overriding the
 * classes directly). Scoped under `.obp-landing` so nothing leaks into the host.
 */
export const LANDING_BASE_CSS = `
.obp-landing {
  --obp-accent: #1d4ed8;
  --obp-accent-contrast: #ffffff;
  --obp-card-bg: #ffffff;
  --obp-card-fg: #111827;
  --obp-card-muted: #6b7280;
  --obp-card-border: #e5e7eb;
  --obp-card-radius: 14px;
  --obp-card-shadow: 0 1px 2px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.05);
  --obp-verb-get: #15803d;
  --obp-verb-post: #1d4ed8;
  --obp-verb-put: #b45309;
  --obp-verb-delete: #b91c1c;
}
.obp-landing .obp-products--cards { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.obp-landing .obp-products--list { display: flex; flex-direction: column; gap: 10px; }
.obp-landing .obp-product-card { background: var(--obp-card-bg); color: var(--obp-card-fg); border: 1px solid var(--obp-card-border); border-radius: var(--obp-card-radius); box-shadow: var(--obp-card-shadow); padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; }
.obp-landing .obp-product-category { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--obp-accent); font-weight: 600; }
.obp-landing .obp-product-name { margin: 0; font-size: 18px; line-height: 1.25; }
.obp-landing .obp-product-description { margin: 0; color: var(--obp-card-muted); font-size: 14px; line-height: 1.5; }
.obp-landing .obp-product-price { margin-top: auto; font-weight: 700; }
.obp-landing .obp-product-link { color: var(--obp-accent); font-weight: 600; text-decoration: none; }
.obp-landing .obp-product-link:hover { text-decoration: underline; }

.obp-landing .obp-endpoints { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.obp-landing .obp-endpoint { background: var(--obp-card-bg); color: var(--obp-card-fg); border: 1px solid var(--obp-card-border); border-radius: 10px; padding: 10px 14px; }
.obp-landing .obp-endpoint a { color: inherit; text-decoration: none; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.obp-landing .obp-endpoint > span, .obp-landing .obp-endpoint > code { margin-right: 10px; }
.obp-landing .obp-endpoint-verb { font: 700 11px/1 ui-monospace, monospace; padding: 4px 7px; border-radius: 6px; color: #fff; background: var(--obp-card-muted); }
.obp-landing .obp-endpoint-verb--get { background: var(--obp-verb-get); }
.obp-landing .obp-endpoint-verb--post { background: var(--obp-verb-post); }
.obp-landing .obp-endpoint-verb--put { background: var(--obp-verb-put); }
.obp-landing .obp-endpoint-verb--delete { background: var(--obp-verb-delete); }
.obp-landing .obp-endpoint-url { font-size: 13px; }
.obp-landing .obp-endpoint-summary { color: var(--obp-card-muted); font-size: 13px; flex-basis: 100%; }

.obp-landing .obp-banks { display: flex; flex-wrap: wrap; gap: 12px; }
.obp-landing .obp-bank { background: var(--obp-card-bg); color: var(--obp-card-fg); border: 1px solid var(--obp-card-border); border-radius: 999px; padding: 8px 14px 8px 10px; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; }
.obp-landing .obp-bank a { color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; }
.obp-landing .obp-bank-logo { width: 22px; height: 22px; object-fit: contain; border-radius: 50%; background: #fff; }

.obp-landing .obp-signup { display: inline-block; padding: 12px 22px; border-radius: 10px; font-weight: 700; text-decoration: none; }
.obp-landing .obp-signup--primary { background: var(--obp-accent); color: var(--obp-accent-contrast); }
.obp-landing .obp-signup--secondary { background: transparent; color: var(--obp-accent); border: 2px solid var(--obp-accent); }

.obp-landing .obp-stat { font-weight: 800; }

.obp-landing [data-behaviour="countdown"] { display: inline-flex; gap: 14px; }
.obp-landing .obp-countdown-part { display: inline-flex; flex-direction: column; align-items: center; min-width: 56px; }
.obp-landing .obp-countdown-value { font: 800 28px/1 ui-monospace, monospace; }
.obp-landing .obp-countdown-label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; opacity: .7; margin-top: 4px; }

.obp-landing [data-behaviour="tabs"] [data-tab] { cursor: pointer; }
.obp-landing [data-behaviour="tabs"] [data-tab].is-active { font-weight: 700; }
.obp-landing [data-behaviour="reveal"] { opacity: 0; transform: translateY(12px); transition: opacity .5s ease, transform .5s ease; }
.obp-landing [data-behaviour="reveal"].is-visible { opacity: 1; transform: none; }
.obp-landing [data-behaviour="carousel"] { display: flex; align-items: center; gap: 8px; }
.obp-landing [data-behaviour="carousel"] [data-track] { flex: 1; display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
.obp-landing [data-behaviour="carousel"] [data-track] > * { scroll-snap-align: start; flex: 0 0 min(80%, 300px); }

.obp-landing .obp-block-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 14px; }
`;
