import { createLogger } from '$lib/utils/logger';
const logger = createLogger('ConfirmBGConsentRequest');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect, isRedirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '$lib/obp/errors';
import type { OBPBGConsentAccess } from '$lib/obp/types';
import { env } from '$env/dynamic/private';

function decodeJwtPayload(jwt: string): any {
	try {
		const parts = jwt.split('.');
		if (parts.length !== 3) return {};
		const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
		return JSON.parse(jsonPayload);
	} catch {
		logger.warn('Could not decode JWT payload');
		return {};
	}
}

export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');


	const emptyResult = {
		consentId: consentId || '',
		consent: null,
		access: {} as OBPBGConsentAccess,
		validUntil: '',
		tppRedirectUri: '',
		tppNokRedirectUri: '',
		consumerName: '',
		userIbans: [] as any[],
		needsAccountSelection: false,
		allAccountsRequested: false,
		hasAccountAccess: false,
		hasBalanceAccess: false,
		hasTransactionAccess: false,
		preSelectedIbans: [] as string[],
	};

	if (!consentId) {
		return { ...emptyResult, loadError: 'Missing required parameter: CONSENT_ID.' };
	}

	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		return { ...emptyResult, loadError: 'Unauthorized: No access token found in session.' };
	}

	try {
		// Step 1: Get consent details
		const consent = await obp_requests.get(
			`/obp/v5.1.0/user/current/consents/${consentId}`,
			token
		);

		// Step 2: Decode JWT
		const jwtPayload = decodeJwtPayload(consent.jwt);
		const access: OBPBGConsentAccess = jwtPayload.access || {};
		const requestHeaders = jwtPayload.request_headers || [];
		const validUntil = jwtPayload.validUntil || '';

		let tppRedirectUri = '';
		let tppNokRedirectUri = '';
		for (const header of requestHeaders) {
			if (header['TPP-Redirect-URI']) {
				tppRedirectUri = header['TPP-Redirect-URI'];
			}
			if (header['TPP-Nok-Redirect-URI']) {
				tppNokRedirectUri = header['TPP-Nok-Redirect-URI'];
			}
		}

		// Step 3: Get consumer/TPP name
		let consumerName = 'Unknown Application';
		try {
			const consumer = await obp_requests.get(
				`/obp/v5.1.0/management/consumers/${consent.consumer_id}`,
				token
			);
			consumerName = consumer.app_name || 'Unknown Application';
		} catch (e) {
			logger.warn('Could not fetch consumer details:', e);
		}

		// Step 4: Get user's accounts for IBAN selection
		let userAccounts: any[] = [];
		try {
			const accountsResponse = await obp_requests.get('/obp/v6.0.0/my/accounts', token);
			userAccounts = accountsResponse.accounts || [];
		} catch (e) {
			logger.warn('Could not fetch user accounts:', e);
		}

		const userIbans = userAccounts
			.map((account: any) => {
				const ibanRouting = (account.account_routings || []).find(
					(r: any) => r.scheme === 'IBAN'
				);
				return {
					accountId: account.id,
					bankId: account.bank_id,
					iban: ibanRouting?.address || '',
					label: account.label || account.id
				};
			})
			.filter((a: any) => a.iban);

		const needsAccountSelection =
			Array.isArray(access.accounts) && access.accounts.length === 0;
		const allAccountsRequested = access.availableAccounts === 'allAccounts';
		const hasAccountAccess = !!access.accounts;
		const hasBalanceAccess = !!access.balances;
		const hasTransactionAccess = !!access.transactions;

		let preSelectedIbans: string[] = [];
		if (allAccountsRequested) {
			preSelectedIbans = userIbans.map((a: any) => a.iban);
		} else if (!needsAccountSelection && Array.isArray(access.accounts)) {
			preSelectedIbans = access.accounts.map((a: any) => a.iban);
		}

		return {
			consentId,
			consent,
			access,
			validUntil,
			tppRedirectUri,
			tppNokRedirectUri,
			consumerName,
			userIbans,
			needsAccountSelection,
			allAccountsRequested,
			hasAccountAccess,
			hasBalanceAccess,
			hasTransactionAccess,
			preSelectedIbans,
			};
	} catch (e) {
		logger.error('Error loading BG consent request:', e);
		let errorMessage = 'Could not fetch consent details.';
		if (e instanceof OBPRequestError) {
			errorMessage = e.message;
		}
		return { ...emptyResult, loadError: errorMessage };
	}
}

export const actions = {
	confirm: async ({ request, locals }) => {
		const formData = await request.formData();
		const consentId = formData.get('consentId') as string;
		const selectedIbans = formData.getAll('selectedIbans') as string[];
		const hasBalanceAccess = formData.get('hasBalanceAccess') === 'true';
		const hasTransactionAccess = formData.get('hasTransactionAccess') === 'true';

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { error: 'No access token found in session.' };
		}

		const defaultBankId = env.DEFAULT_BANK_ID;
		if (!defaultBankId) {
			logger.error('DEFAULT_BANK_ID environment variable is not set');
			return { error: 'Server configuration error: DEFAULT_BANK_ID is not set.' };
		}

		try {
			if (selectedIbans.length > 0) {
				const ibanObjects = selectedIbans.map((iban) => ({ iban }));
				const access: Record<string, { iban: string }[]> = {
					accounts: ibanObjects
				};
				if (hasBalanceAccess) {
					access.balances = ibanObjects;
				}
				if (hasTransactionAccess) {
					access.transactions = ibanObjects;
				}

				await obp_requests.put(
					`/obp/v6.0.0/management/banks/${defaultBankId}/consents/${consentId}/account-access`,
					{ access },
					token
				);
				logger.info('Updated consent account access for consent:', consentId);
			}

			redirect(303, `/confirm-bg-consent-request-sca?CONSENT_ID=${consentId}`);
		} catch (e) {
			if (isRedirect(e)) throw e;
			logger.error('Error confirming BG consent request:', e);
			let errorMessage = 'Failed to confirm consent request.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { error: errorMessage };
		}
	},

	deny: async ({ request, locals }) => {
		const formData = await request.formData();
		const consentId = formData.get('consentId') as string;
		const tppNokRedirectUri = formData.get('tppNokRedirectUri') as string;

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { error: 'No access token found in session.' };
		}

		const defaultBankId = env.DEFAULT_BANK_ID;
		if (!defaultBankId) {
			logger.error('DEFAULT_BANK_ID environment variable is not set');
			return { error: 'Server configuration error: DEFAULT_BANK_ID is not set.' };
		}

		try {
			await obp_requests.put(
				`/obp/v6.0.0/banks/${defaultBankId}/consents/${consentId}`,
				{ status: 'REJECTED' },
				token
			);
			logger.info('Consent rejected:', consentId);

			if (tppNokRedirectUri) {
				redirect(303, tppNokRedirectUri);
			}

			return { success: true, message: 'Consent denied.' };
		} catch (e) {
			if (isRedirect(e)) throw e;
			logger.error('Error denying BG consent:', e);
			let errorMessage = 'Failed to deny consent.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { error: errorMessage };
		}
	}
} satisfies Actions;
