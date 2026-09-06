import { createLogger } from '@obp/shared/utils';
const logger = createLogger('OBPRequests');
import { env } from '$env/dynamic/public';
import { OBPErrorBase, OBPRequestError, OBPRateLimitError, OBPTimeoutError } from '@obp/shared/obp';

const DEFAULT_TIMEOUT_MS = 15_000;

class OBPRequests {
	base_url: string;

	constructor(base_url: string) {
		logger.info('Initializing with base URL:', base_url);

		if (!base_url) {
			throw new OBPErrorBase('Base URL for OBP requests is not defined.');
		}
		this.base_url = base_url;

		logger.info('Initialized.');
	}

	/**
	 * The error the API actually reported, or null when the body carries none.
	 *
	 * Two shapes reach here. OBP's own endpoints answer `{code, message}`; Berlin Group answers
	 * `{tppMessages: [{code, text}]}`, which is what NextGenPSD2 specifies. Only the first was
	 * understood, so every Berlin Group failure fell through to a generic "Error posting OBP data"
	 * and the reason never reached the PSU -- an account-ownership refusal reads exactly like a
	 * transport fault.
	 */
	private static apiError(data: any): { code: string | number; message: string } | null {
		if (data?.code && data?.message) {
			return { code: data.code, message: data.message };
		}
		const tppMessage = data?.tppMessages?.[0];
		if (tppMessage?.text) {
			return { code: tppMessage.code ?? 'ERROR', message: tppMessage.text };
		}
		return null;
	}

	private logRateLimitInfo(response: Response, url: string): void {
		const remaining = response.headers.get('X-Rate-Limit-Remaining');
		if (remaining !== null && parseInt(remaining) < 0) {
			logger.warn(`Rate limit header warning for ${url}: X-Rate-Limit-Remaining=${remaining}`);
		}
	}

	async get(endpoint: string, accessToken?: string): Promise<any> {
		logger.debug('GET', endpoint);
		const url = `${this.base_url}${endpoint}`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (accessToken) {
			headers['Authorization'] = `Bearer ${accessToken}`;
		}

		let response: Response;
		try {
			response = await fetch(url, {
				headers,
				signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'TimeoutError') {
				throw new OBPTimeoutError(url, DEFAULT_TIMEOUT_MS);
			}
			throw error;
		}

		this.logRateLimitInfo(response, url);

		let data;
		try {
			data = await response.json();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new OBPErrorBase(`Failed to parse JSON response from ${url}: ${message}`);
		}

		if (!response.ok) {
			logger.error('Failed to fetch OBP data:', { statusText: response.statusText, data });

			if (response.status === 429) {
				const reset = response.headers.get('X-Rate-Limit-Reset');
				throw new OBPRateLimitError(
					data?.message || `Rate limit exceeded for ${url}`,
					reset ? parseInt(reset) : undefined
				);
			}

			const apiError = OBPRequests.apiError(data);
			if (apiError) {
				throw new OBPRequestError(apiError.code as any, apiError.message);
			} else {
				throw new OBPErrorBase(`Error fetching OBP data from ${url}: ${response.statusText}`);
			}
		}

		logger.debug('Response from OBP', response.status, response.statusText);
		logger.debug('GET done');
		return data;
	}

	async post(endpoint: string, body: any, accessToken?: string): Promise<any> {
		logger.debug('POST', endpoint, body);
		const url = `${this.base_url}${endpoint}`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (accessToken) {
			headers['Authorization'] = `Bearer ${accessToken}`;
		}
		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
		});

		let data;
		try {
			data = await response.json();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new OBPErrorBase(`Failed to parse JSON response from ${url}: ${message}`);
		}

		if (!response.ok) {
			logger.error('Failed to post OBP data:', { statusText: response.statusText, data });

			const apiError = OBPRequests.apiError(data);
			if (apiError) {
				throw new OBPRequestError(apiError.code as any, apiError.message);
			} else {
				throw new OBPErrorBase(`Error posting OBP data to ${url}: ${response.statusText}`);
			}
		}

		logger.debug('Response from OBP', response.status, response.statusText);
		logger.debug('POST done');
		return data;
	}

	async delete(endpoint: string, accessToken?: string): Promise<any> {
		logger.debug('DELETE', endpoint);
		const url = `${this.base_url}${endpoint}`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (accessToken) {
			headers['Authorization'] = `Bearer ${accessToken}`;
		}
		const response = await fetch(url, {
			method: 'DELETE',
			headers,
			signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
		});

		// Handle empty responses (common for DELETE returning 204 No Content)
		let data = null;
		const contentLength = response.headers.get('content-length');
		const hasContent = contentLength && parseInt(contentLength) > 0;

		if (hasContent || response.status !== 204) {
			const text = await response.text();
			if (text) {
				try {
					data = JSON.parse(text);
				} catch (error) {
					// If response is not ok and we can't parse JSON, we'll handle it below
					if (!response.ok) {
						throw new OBPErrorBase(`Error deleting OBP data from ${url}: ${response.statusText}`);
					}
				}
			}
		}

		if (!response.ok) {
			logger.error('Failed to delete OBP data:', response.statusText, data);
			const apiError = OBPRequests.apiError(data);
			if (apiError) {
				throw new OBPRequestError(apiError.code as any, apiError.message);
			} else {
				throw new OBPErrorBase(`Error deleting OBP data from ${url}: ${response.statusText}`);
			}
		}

		logger.debug('Response from OBP', response.status, response.statusText);
		logger.debug('DELETE done');
		return data;
	}

	async put(endpoint: string, body: any, accessToken?: string): Promise<any> {
		logger.debug('PUT', endpoint, body);
		const url = `${this.base_url}${endpoint}`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (accessToken) {
			headers['Authorization'] = `Bearer ${accessToken}`;
		}
		const response = await fetch(url, {
			method: 'PUT',
			headers,
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
		});

		let data;
		try {
			data = await response.json();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new OBPErrorBase(`Failed to parse JSON response from ${url}: ${message}`);
		}

		if (!response.ok) {
			logger.error('Failed to put OBP data:', { statusText: response.statusText, data });
			const apiError = OBPRequests.apiError(data);
			if (apiError) {
				throw new OBPRequestError(apiError.code as any, apiError.message);
			} else {
				throw new OBPErrorBase(`Error putting OBP data to ${url}: ${response.statusText}`);
			}
		}

		logger.debug('Response from OBP', response.status, response.statusText);
		logger.debug('PUT done');
		return data;
	}

	async patch(endpoint: string, body: any, accessToken?: string): Promise<any> {
		logger.debug('PATCH', endpoint, body);
		const url = `${this.base_url}${endpoint}`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (accessToken) {
			headers['Authorization'] = `Bearer ${accessToken}`;
		}
		const response = await fetch(url, {
			method: 'PATCH',
			headers,
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
		});

		let data;
		try {
			data = await response.json();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new OBPErrorBase(`Failed to parse JSON response from ${url}: ${message}`);
		}

		if (!response.ok) {
			logger.error('Failed to patch OBP data:', { statusText: response.statusText, data });
			const apiError = OBPRequests.apiError(data);
			if (apiError) {
				throw new OBPRequestError(apiError.code as any, apiError.message);
			} else {
				throw new OBPErrorBase(`Error patching OBP data to ${url}: ${response.statusText}`);
			}
		}

		logger.debug('Response from OBP', response.status, response.statusText);
		logger.debug('PATCH done');
		return data;
	}
}

let obp_requests_instance: OBPRequests | null = null;

export const obp_requests = {
	get instance(): OBPRequests {
		if (!obp_requests_instance) {
			obp_requests_instance = new OBPRequests(env.PUBLIC_OBP_BASE_URL);
		}
		return obp_requests_instance;
	},

	get: function (endpoint: string, accessToken?: string) {
		return this.instance.get(endpoint, accessToken);
	},

	post: function (endpoint: string, data: any, accessToken?: string) {
		return this.instance.post(endpoint, data, accessToken);
	},

	put: function (endpoint: string, data: any, accessToken?: string) {
		return this.instance.put(endpoint, data, accessToken);
	},

	patch: function (endpoint: string, data: any, accessToken?: string) {
		return this.instance.patch(endpoint, data, accessToken);
	},

	delete: function (endpoint: string, accessToken?: string) {
		return this.instance.delete(endpoint, accessToken);
	}
};
