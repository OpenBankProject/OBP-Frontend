/*
 * Copyright (C) 2026 TESOBE GmbH
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
import '@obp/shared/server/monitoring/capture';
import { requestTelemetry, startTelemetry } from '@obp/shared/server/monitoring';
import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { sveltekitSessionHandle } from 'svelte-kit-sessions';
import RedisStore from 'svelte-kit-connect-redis';
import { createLogger, reloadPathAfterSessionEnds } from '@obp/shared/utils';
import { loginUrlReturningTo } from '@obp/shared/server/auth';
import { i18nHandle } from '@obp/shared/server/i18n';
import { withBranding } from '@obp/shared/branding';
import { conformatorBranding } from '$lib/server/branding';
import { healthCheckRegistry } from '@obp/shared/health-check';
import { oauth2ProviderManager, sessionOAuth, SESSION_COOKIE } from '$lib/server/oauth';
import { redisService } from '$lib/server/redis';
import { consumerScopesCheck } from '$lib/server/consumerScopes';
import { ensureCentralEntities } from '$lib/server/entities/bootstrap';

const logger = createLogger('ConformanceHooks');

// Telemetry for GET /monitoring/telemetry: this app's requests and its calls to OBP-API.
startTelemetry('conformator', publicEnv.PUBLIC_OBP_BASE_URL);

if (!building) {
	if (!env.SESSION_SECRET || typeof env.SESSION_SECRET !== 'string') {
		throw new Error(
			'SESSION_SECRET environment variable is required but not set. Set it to a long random string ' +
				'in the runtime environment (.env, docker-compose or docker run -e SESSION_SECRET=...).'
		);
	}
	await oauth2ProviderManager.start();
	// Checks the app's Consumer Scopes and declares them to OBP as a Platform App, every minute; see /setup.
	healthCheckRegistry.register(consumerScopesCheck);
	consumerScopesCheck.start();
	startEntityBootstrap();
}

/**
 * Create the central entities and start their audit chains, and keep trying every five minutes until all are done, so granting the Scopes later takes effect without a restart. A dev-server reload starts a new loop and stops the old one.
 */
function startEntityBootstrap() {
	const key = Symbol.for('obp.conformator.entityBootstrap');
	const globals = globalThis as typeof globalThis & { [key: symbol]: ReturnType<typeof setInterval> | undefined };
	if (globals[key]) clearInterval(globals[key]);
	const attempt = async () => {
		if ((await ensureCentralEntities().catch(() => false)) && globals[key]) {
			clearInterval(globals[key]);
			globals[key] = undefined;
		}
	};
	globals[key] = setInterval(() => void attempt(), 5 * 60 * 1000);
	void attempt();
}

/** A session whose OAuth data is missing or whose token cannot be refreshed is ended. */
const checkSessionValidity: Handle = async ({ event, resolve }) => {
	const session = event.locals.session;
	if (!session.data.user) return resolve(event);

	const username = session.data.user.username || session.data.user.email;
	const oauth = sessionOAuth.getSessionOAuth(session);
	if (!oauth) {
		logger.warn(`Session for ${username} (${session.id}) has no valid OAuth data. Destroying session.`);
		await session.destroy();
		redirect(302, reloadPathAfterSessionEnds(event.url));
	}

	if (await oauth.client.checkAccessTokenExpiration(oauth.accessToken)) {
		try {
			await sessionOAuth.refreshAccessToken(session);
			logger.info(`Token refreshed for ${username} (${session.id})`);
		} catch (err) {
			logger.info(`Token refresh failed for ${username} (${session.id}); ending session:`, err);
			await session.destroy();
			redirect(302, reloadPathAfterSessionEnds(event.url));
		}
	}

	return resolve(event);
};

/** Pages in the (protected) route group need a logged-in User. */
const checkAuthorization: Handle = async ({ event, resolve }) => {
	if (event.route.id?.startsWith('/(protected)/')) {
		if (!oauth2ProviderManager.isReady()) {
			error(503, 'Service Unavailable. Please try again later.');
		}
		if (!event.locals.session.data.user) {
			redirect(302, loginUrlReturningTo(event.url.pathname + event.url.search));
		}
	}
	return resolve(event);
};

/** The theme, extra stylesheet and favicon from the CONFORMATOR_* settings, in app.html. */
const branding: Handle = ({ event, resolve }) => resolve(event, { transformPageChunk: ({ html }) => withBranding(html, conformatorBranding) });

export const handle: Handle = sequence(
	requestTelemetry,
	branding,
	// The page's language (and lang and dir in app.html), before anything draws a page
	i18nHandle,
	sveltekitSessionHandle({
		name: SESSION_COOKIE,
		// Checked at startup above; only unset while building.
		secret: env.SESSION_SECRET ?? '',
		cookie: { httpOnly: true, secure: true, sameSite: 'lax' },
		store: new RedisStore({
			client: redisService.getClient(),
			prefix: 'obp-conformator-session:'
		})
	}),
	checkSessionValidity,
	checkAuthorization
);
