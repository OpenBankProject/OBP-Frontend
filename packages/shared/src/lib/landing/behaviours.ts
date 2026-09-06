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
/**
 * Landing page blocks: the behaviours script.
 *
 * The one trusted script a landing page gets. It looks for `data-behaviour`
 * attributes (see registry.ts) and wires them up. Authors write markup only.
 * Call `initLandingBehaviours(root)` after the page HTML is in the DOM; the
 * returned function tears everything down again (timers, observers, listeners).
 */

type Teardown = () => void;

function pad(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

function initCountdown(el: HTMLElement): Teardown {
	const until = Date.parse(el.dataset.until ?? '');
	if (Number.isNaN(until)) {
		el.textContent = 'Invalid date';
		return () => {};
	}
	const doneText = el.dataset.done ?? 'Started';
	const parts: Array<[string, string]> = [
		['days', 'Days'],
		['hours', 'Hours'],
		['minutes', 'Minutes'],
		['seconds', 'Seconds']
	];
	el.innerHTML = parts
		.map(
			([key, label]) =>
				`<span class="obp-countdown-part obp-countdown-part--${key}"><span class="obp-countdown-value">00</span><span class="obp-countdown-label">${label}</span></span>`
		)
		.join('');
	const values = el.querySelectorAll<HTMLElement>('.obp-countdown-value');

	function tick() {
		const diff = until - Date.now();
		if (diff <= 0) {
			el.classList.add('is-done');
			el.textContent = doneText;
			clearInterval(timer);
			return;
		}
		const s = Math.floor(diff / 1000);
		const d = Math.floor(s / 86400);
		const h = Math.floor((s % 86400) / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		[d, h, m, sec].forEach((v, i) => {
			if (values[i]) values[i].textContent = i === 0 ? String(v) : pad(v);
		});
	}
	const timer = setInterval(tick, 1000);
	tick();
	return () => clearInterval(timer);
}

function initTabs(el: HTMLElement): Teardown {
	const tabs = Array.from(el.querySelectorAll<HTMLElement>('[data-tab]'));
	const panels = Array.from(el.querySelectorAll<HTMLElement>('[data-panel]'));
	if (tabs.length === 0) return () => {};

	function activate(key: string) {
		tabs.forEach((t) => {
			const active = t.dataset.tab === key;
			t.classList.toggle('is-active', active);
			t.setAttribute('aria-selected', active ? 'true' : 'false');
		});
		panels.forEach((p) => {
			const active = p.dataset.panel === key;
			p.classList.toggle('is-active', active);
			p.hidden = !active;
		});
	}
	const onClick = (e: Event) => {
		const target = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
		if (target && el.contains(target)) activate(target.dataset.tab ?? '');
	};
	tabs.forEach((t) => t.setAttribute('role', 'tab'));
	panels.forEach((p) => p.setAttribute('role', 'tabpanel'));
	el.addEventListener('click', onClick);
	activate(tabs[0].dataset.tab ?? '');
	return () => el.removeEventListener('click', onClick);
}

function initCopy(el: HTMLElement): Teardown {
	const original = el.textContent;
	const onClick = async () => {
		const selector = el.dataset.target ?? '';
		const source = selector ? document.querySelector<HTMLElement>(selector) : null;
		if (!source) return;
		try {
			await navigator.clipboard.writeText(source.textContent ?? '');
			el.classList.add('is-copied');
			el.textContent = el.dataset.copiedLabel ?? 'Copied';
			setTimeout(() => {
				el.classList.remove('is-copied');
				el.textContent = original;
			}, 1500);
		} catch {
			/* clipboard unavailable: leave the button as it is */
		}
	};
	el.addEventListener('click', onClick);
	return () => el.removeEventListener('click', onClick);
}

function initReveal(el: HTMLElement): Teardown {
	if (typeof IntersectionObserver === 'undefined') {
		el.classList.add('is-visible');
		return () => {};
	}
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					el.classList.add('is-visible');
					observer.disconnect();
				}
			}
		},
		{ threshold: 0.15 }
	);
	observer.observe(el);
	return () => observer.disconnect();
}

function initCarousel(el: HTMLElement): Teardown {
	const track = el.querySelector<HTMLElement>('[data-track]');
	if (!track) return () => {};
	const step = () => Math.max(track.clientWidth * 0.8, 200);
	const prev = () => track.scrollBy({ left: -step(), behavior: 'smooth' });
	const next = () => track.scrollBy({ left: step(), behavior: 'smooth' });
	const prevBtn = el.querySelector<HTMLElement>('[data-prev]');
	const nextBtn = el.querySelector<HTMLElement>('[data-next]');
	prevBtn?.addEventListener('click', prev);
	nextBtn?.addEventListener('click', next);
	return () => {
		prevBtn?.removeEventListener('click', prev);
		nextBtn?.removeEventListener('click', next);
	};
}

const INITIALISERS: Record<string, (el: HTMLElement) => Teardown> = {
	countdown: initCountdown,
	tabs: initTabs,
	copy: initCopy,
	reveal: initReveal,
	carousel: initCarousel
};

/** Wire up every `[data-behaviour]` under `root`. Returns a teardown function. */
export function initLandingBehaviours(root: ParentNode = document): Teardown {
	const teardowns: Teardown[] = [];
	root.querySelectorAll<HTMLElement>('[data-behaviour]').forEach((el) => {
		const init = INITIALISERS[el.dataset.behaviour ?? ''];
		if (init) teardowns.push(init(el));
	});
	return () => teardowns.forEach((t) => t());
}

export const LANDING_BEHAVIOUR_NAMES = Object.keys(INITIALISERS);
