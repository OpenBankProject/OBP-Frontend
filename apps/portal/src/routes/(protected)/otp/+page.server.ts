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
import { createLogger } from '@obp/shared/utils';
const logger = createLogger('OTPValidation');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';

export async function load(event: RequestEvent) {
	const flow = event.url.searchParams.get('flow');


	if (!flow || (flow !== 'payment' && flow !== 'transaction_request')) {
		return {
			loadError: 'Missing or invalid flow parameter. Must be "payment" or "transaction_request".',
			flow: flow || '',
			};
	}

	if (flow === 'payment') {
		const paymentService = event.url.searchParams.get('paymentService');
		const paymentProduct = event.url.searchParams.get('paymentProduct');
		const paymentId = event.url.searchParams.get('paymentId');

		if (!paymentService || !paymentProduct || !paymentId) {
			return {
				loadError:
					'Missing required parameters for payment flow: paymentService, paymentProduct, paymentId.',
				flow,
					};
		}

		return { flow, paymentService, paymentProduct, paymentId };
	}

	// transaction_request flow
	const id = event.url.searchParams.get('id');
	const bankId = event.url.searchParams.get('bankId');
	const accountId = event.url.searchParams.get('accountId');
	const viewId = event.url.searchParams.get('viewId');
	const transactionRequestType = event.url.searchParams.get('transactionRequestType');
	const transactionRequestId = event.url.searchParams.get('transactionRequestId');

	if (!id || !bankId || !accountId || !viewId || !transactionRequestType || !transactionRequestId) {
		return {
			loadError:
				'Missing required parameters for transaction_request flow: id, bankId, accountId, viewId, transactionRequestType, transactionRequestId.',
			flow,
			};
	}

	return {
		flow,
		id,
		bankId,
		accountId,
		viewId,
		transactionRequestType,
		transactionRequestId,
	};
}

export const actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const otp = formData.get('otp') as string;
		const flow = formData.get('flow') as string;

		if (!otp) {
			return { message: 'Please enter the OTP code.' };
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		try {
			if (flow === 'payment') {
				const paymentService = formData.get('paymentService') as string;
				const paymentProduct = formData.get('paymentProduct') as string;
				const paymentId = formData.get('paymentId') as string;

				// Step 1: Create authorisation
				const authResponse = await obp_requests.post(
					`/berlin-group/v1.3/${paymentService}/${paymentProduct}/${paymentId}/authorisations`,
					{},
					token
				);

				const authorisationId = authResponse.authorisation_id;

				// Step 2: Submit OTP to authorisation
				await obp_requests.put(
					`/berlin-group/v1.3/${paymentService}/${paymentProduct}/${paymentId}/authorisations/${authorisationId}`,
					{ scaAuthenticationData: otp },
					token
				);

				return { success: true, message: 'Payment authorised successfully.' };
			} else {
				// transaction_request flow
				const id = formData.get('id') as string;
				const bankId = formData.get('bankId') as string;
				const accountId = formData.get('accountId') as string;
				const viewId = formData.get('viewId') as string;
				const transactionRequestType = formData.get('transactionRequestType') as string;
				const transactionRequestId = formData.get('transactionRequestId') as string;

				await obp_requests.post(
					`/obp/v4.0.0/banks/${bankId}/accounts/${accountId}/${viewId}/transaction-request-types/${transactionRequestType}/transaction-requests/${transactionRequestId}/challenge`,
					{ id, answer: otp },
					token
				);

				return { success: true, message: 'Transaction request authorised successfully.' };
			}
		} catch (e) {
			logger.error('Error processing OTP:', e);
			let errorMessage = 'Failed to process OTP.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { message: errorMessage };
		}
	}
} satisfies Actions;
