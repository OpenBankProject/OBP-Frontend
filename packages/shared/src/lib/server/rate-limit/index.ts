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
 * Helpers shared by the apps' `hooks.server.ts` rate limiters.
 *
 * Limits are keyed on client IP, so a room full of people behind one NAT
 * (a hackathon, an office) shares a single bucket. Keep the defaults generous
 * enough for a legitimate onboarding burst and make them tunable via env so
 * an event doesn't need a redeploy.
 */
import { createLogger } from '$shared/utils/logger';
import type { Rate, RateUnit } from 'sveltekit-rate-limiter/server';

const logger = createLogger('RateLimit');

/** Window units accepted by `sveltekit-rate-limiter` (mirrors its `RateUnit`). */
export const RATE_LIMIT_UNITS: readonly RateUnit[] = [
	'ms', '100ms', '250ms', '500ms',
	's', '2s', '5s', '10s', '15s', '30s', '45s',
	'm', '2m', '5m', '10m', '15m', '30m', '45m',
	'h', '2h', '6h', '12h', 'd'
];

/**
 * Parse a rate limit from an env var written as `<count>/<window>`, e.g.
 * `20/15m` (20 requests per 15 minutes) or `30/m` (30 per minute).
 *
 * Returns `fallback` when the variable is unset. A malformed value also falls
 * back, with a warning, rather than crashing startup or silently disabling
 * the limit.
 */
export function parseRateLimit(name: string, value: string | undefined, fallback: Rate): Rate {
	if (value === undefined || value.trim() === '') return fallback;

	const match = /^\s*(\d+)\s*\/\s*([a-z0-9]+)\s*$/i.exec(value);
	const count = match ? Number(match[1]) : NaN;
	const unit = match?.[2]?.toLowerCase() as RateUnit | undefined;

	if (!match || !Number.isInteger(count) || count < 1 || !unit || !RATE_LIMIT_UNITS.includes(unit)) {
		logger.warn(
			`${name}="${value}" is not a valid rate limit; expected "<count>/<window>" such as "20/15m" ` +
				`(windows: ${RATE_LIMIT_UNITS.join(', ')}). Using default ${formatRate(fallback)}.`
		);
		return fallback;
	}
	return [count, unit];
}

/** `[20, '15m']` → `"20/15m"`, for logs and diagnostics. */
export function formatRate([count, unit]: Rate): string {
	return `${count}/${unit}`;
}

/** Set on `event.locals` by the hook when a form POST has been rate limited. */
export interface RateLimitInfo {
	/** Seconds until the client may retry. */
	retryAfter: number;
}

/**
 * Human-readable explanation for a rate-limited form submission. Mentions the
 * shared network because that is the usual reason an innocent user hits it.
 */
export function rateLimitMessage({ retryAfter }: RateLimitInfo): string {
	const seconds = Math.max(1, Math.ceil(retryAfter));
	const wait =
		seconds < 90
			? `${seconds} second${seconds === 1 ? '' : 's'}`
			: `${Math.ceil(seconds / 60)} minutes`;
	return `Too many attempts from your network address. Please wait about ${wait} and try again.`;
}

// ---------------------------------------------------------------------------
// Client-IP sanity checks. Per-IP limits are only meaningful if the server can
// see the real client address. adapter-node uses the TCP peer address unless
// ADDRESS_HEADER (and XFF_DEPTH) tell it which proxy header to trust, so a
// deployment behind NGINX / a k8s ingress without those set puts every user in
// one bucket — which looks exactly like "registration broke for everyone".
// ---------------------------------------------------------------------------

/**
 * Call once at startup. Warns in production when ADDRESS_HEADER is unset,
 * otherwise logs which header is in use so the choice is visible in the logs.
 */
export function warnIfClientAddressUnconfigured(): void {
	const header = process.env.ADDRESS_HEADER;
	if (header) {
		logger.info(
			`Client IP for rate limiting is read from the "${header}" header (XFF_DEPTH=${process.env.XFF_DEPTH ?? '1'})`
		);
		return;
	}
	if (process.env.NODE_ENV !== 'production') return;
	logger.warn(
		'ADDRESS_HEADER is not set. If this server runs behind a reverse proxy (NGINX, k8s ingress) ' +
			'every request appears to come from the proxy, so per-IP rate limits become ONE bucket shared ' +
			'by all users. Set ADDRESS_HEADER=x-forwarded-for and XFF_DEPTH=<number of trusted proxies>.'
	);
}

let proxyMismatchReported = false;
let addressErrorReported = false;

/** Test hook: forget that the one-time warnings have been emitted. */
export function _resetClientAddressWarnings(): void {
	proxyMismatchReported = false;
	addressErrorReported = false;
}

/**
 * Resolve the client address a rate limiter will key on, and warn (once per
 * process) when the evidence says the proxy header is not being honoured:
 * the request carries X-Forwarded-For but getClientAddress() returned an
 * address that is not in it.
 *
 * Returns null when the address cannot be determined at all — adapter-node
 * throws if ADDRESS_HEADER names a header the request lacks. Callers should
 * then skip limiting (logged as an error, once) rather than fail every
 * request on the route with a 500.
 *
 * Note X-Forwarded-For is client-controlled when there is no proxy, so a
 * direct request with a forged header can trigger the warning; it only logs.
 */
export function checkClientAddress(event: {
	request: Request;
	getClientAddress: () => string;
}): string | null {
	let address: string;
	try {
		address = event.getClientAddress();
	} catch (error) {
		if (!addressErrorReported) {
			addressErrorReported = true;
			logger.error(
				`Cannot determine client IP (${error instanceof Error ? error.message : String(error)}). ` +
					'Rate-limited routes are being allowed through UNLIMITED until this is fixed. ' +
					'Check ADDRESS_HEADER / XFF_DEPTH match what the proxy in front of this server sends.'
			);
		}
		return null;
	}

	if (!proxyMismatchReported) {
		const forwarded = event.request.headers.get('x-forwarded-for');
		if (forwarded) {
			const hops = forwarded.split(',').map((hop) => hop.trim()).filter(Boolean);
			if (!hops.includes(address)) {
				proxyMismatchReported = true;
				logger.warn(
					`Request carries X-Forwarded-For="${forwarded}" but getClientAddress() returned "${address}". ` +
						'The proxy header is not being honoured, so per-IP rate limits are keyed on the proxy ' +
						'address and shared by ALL users. Set ADDRESS_HEADER=x-forwarded-for and XFF_DEPTH.'
				);
			}
		}
	}
	return address;
}
