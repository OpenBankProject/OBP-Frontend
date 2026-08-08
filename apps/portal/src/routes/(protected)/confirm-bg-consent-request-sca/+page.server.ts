import { createLogger } from '@obp/shared/utils';
const logger = createLogger('ConfirmBGConsentRequestSCA');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect, isRedirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import type {
	OBPBGStartConsentAuthorisation,
	OBPBGConsentAuthorisationResult
} from '$lib/obp/types';

/**
 * Start a Berlin Group consent authorisation and remember which one this PSU is answering.
 *
 * OBP mints a fresh challenge per POST — a new authorisation id and a newly delivered OTP — so this
 * must not run on every render. It is called from load(), and SvelteKit re-runs load() after any
 * action that does not redirect: a mistyped OTP would therefore replace the challenge the PSU is
 * holding, their retry would answer a challenge whose code they have never seen, and that failure
 * would mint another. The PSU can never catch up, and each attempt sends another OTP.
 *
 * So the id is kept in the session and reused for the whole ceremony. `resend` is the one deliberate
 * way to get a new one, for when the code really did expire or never arrived.
 */
async function startAuthorisation(event: RequestEvent, consentId: string, token: string) {
	const startResponse: OBPBGStartConsentAuthorisation = await obp_requests.post(
		`/berlin-group/v1.3/consents/${consentId}/authorisations`,
		{ scaAuthenticationData: '' },
		token
	);
	await event.locals.session.setData({
		...event.locals.session.data,
		bgConsentAuthorisation: { consentId, authorisationId: startResponse.authorisationId }
	});
	return startResponse.authorisationId;
}

/** Forget the remembered authorisation, so the next consent starts its own. */
async function forgetAuthorisation(event: { locals: App.Locals }) {
	const { bgConsentAuthorisation, ...rest } = event.locals.session.data;
	await event.locals.session.setData(rest);
}

export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');

	if (!consentId) {
		return {
			loadError: 'Missing required parameter: CONSENT_ID.',
			consentId: '',
			authorisationId: ''
		};
	}

	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		return {
			loadError: 'No access token found in session.',
			consentId,
			authorisationId: ''
		};
	}

	// Already answering one for this consent: reuse it rather than mint a second and invalidate the
	// code the PSU is looking at. See startAuthorisation.
	const started = event.locals.session.data.bgConsentAuthorisation;
	if (started?.consentId === consentId && started.authorisationId) {
		return { consentId, authorisationId: started.authorisationId };
	}

	try {
		return { consentId, authorisationId: await startAuthorisation(event, consentId, token) };
	} catch (e) {
		logger.error('Error starting BG consent authorisation:', e);
		let errorMessage = 'Failed to start consent authorisation.';
		if (e instanceof OBPRequestError) {
			errorMessage = e.message;
		}
		return { loadError: errorMessage, consentId, authorisationId: '' };
	}
}

export const actions = {
	/**
	 * Deliberately mint a new challenge, for a code that expired or never arrived.
	 *
	 * This is the only path that is supposed to invalidate the previous one, which is why it is a
	 * button the PSU presses rather than something that happens to them on every re-render.
	 */
	resend: async (event) => {
		const consentId = (await event.request.formData()).get('consentId') as string;
		const token = event.locals.session.data.oauth?.access_token;
		if (!consentId || !token) {
			return { message: 'Cannot request a new code: the session or the consent id is missing.' };
		}
		try {
			await startAuthorisation(event as RequestEvent, consentId, token);
			return { message: 'A new code has been sent. Use the most recent one.' };
		} catch (e) {
			event.locals && logger.error('Error restarting BG consent authorisation:', e);
			return {
				message: e instanceof OBPRequestError ? e.message : 'Failed to request a new code.'
			};
		}
	},

	// Named rather than `default` because `resend` exists: SvelteKit refuses a default action
	// alongside named ones.
	confirm: async (event) => {
		const { request, locals } = event;
		const formData = await request.formData();
		const otp = formData.get('otp') as string;
		const consentId = formData.get('consentId') as string;
		const authorisationId = formData.get('authorisationId') as string;

		if (!otp) {
			return { message: 'Please enter the OTP code.' };
		}

		if (!authorisationId) {
			// There is no authorisation to answer because starting one failed, and the reason is
			// already on the page above. Telling the PSU to reload sends them round the same loop.
			return {
				message:
					'This consent has no authorisation to confirm — starting one did not succeed. See the reason above.'
			};
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		try {
			const response: OBPBGConsentAuthorisationResult = await obp_requests.put(
				`/berlin-group/v1.3/consents/${consentId}/authorisations/${authorisationId}`,
				{ scaAuthenticationData: otp },
				token
			);

			if (response.scaStatus === 'valid') {
				// Done with this one; a later consent must not reuse a spent authorisation id.
				await forgetAuthorisation(event);
				redirect(303, `/confirm-bg-consent-request-redirect-uri?CONSENT_ID=${consentId}`);
			}

			return {
				message: `Challenge was not accepted. Status: ${response.scaStatus}`
			};
		} catch (e) {
			if (isRedirect(e)) throw e;
			logger.error('Error submitting BG consent SCA:', e);
			let errorMessage = 'Failed to verify OTP.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { message: errorMessage };
		}
	}
} satisfies Actions;
