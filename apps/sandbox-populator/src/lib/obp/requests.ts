import { createLogger } from '$lib/utils/logger';
const logger = createLogger('OBPRequests');
import { env } from '$env/dynamic/public';
import { OBPErrorBase, OBPRequestError, type OBPRequestDetails, type OBPResponseDetails } from '$lib/obp/errors';

class OBPRequests {
	base_url: string;

	constructor(base_url: string | undefined) {
		logger.info('Initializing with base URL:', base_url);

		if (!base_url) {
			throw new OBPErrorBase('Base URL for OBP requests is not defined.');
		}
		this.base_url = base_url;

		logger.info('Initialized.');
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

		const requestDetails: OBPRequestDetails = {
			method: 'GET',
			url,
			headers
		};

		const response = await fetch(url, {
			headers
		});

		let data;
		try {
			data = await response.json();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new OBPErrorBase(`Failed to parse JSON response from ${url}: ${message}`);
		}

		if (!response.ok) {
			logger.error('Failed to fetch OBP data:', { statusText: response.statusText, data });

			const responseDetails: OBPResponseDetails = {
				status: response.status,
				statusText: response.statusText,
				data
			};

			if (data && data.code && data.message) {
				throw new OBPRequestError(data.code, data.message, requestDetails, responseDetails);
			} else {
				throw new OBPRequestError(
					response.status,
					`Error fetching OBP data from ${url}: ${response.statusText}`,
					requestDetails,
					responseDetails
				);
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

		const requestDetails: OBPRequestDetails = {
			method: 'POST',
			url,
			headers,
			body
		};

		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
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

			const responseDetails: OBPResponseDetails = {
				status: response.status,
				statusText: response.statusText,
				data
			};

			if (data && data.code && data.message) {
				throw new OBPRequestError(data.code, data.message, requestDetails, responseDetails);
			} else {
				throw new OBPRequestError(
					response.status,
					`Error posting OBP data to ${url}: ${response.statusText}`,
					requestDetails,
					responseDetails
				);
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

		const requestDetails: OBPRequestDetails = {
			method: 'DELETE',
			url,
			headers
		};

		const response = await fetch(url, {
			method: 'DELETE',
			headers
		});

		let data;
		try {
			data = await response.json();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new OBPErrorBase(`Failed to parse JSON response from ${url}: ${message}`);
		}

		if (!response.ok) {
			logger.error('Failed to delete OBP data:', response.statusText, data);

			const responseDetails: OBPResponseDetails = {
				status: response.status,
				statusText: response.statusText,
				data
			};

			if (data && data.code && data.message) {
				throw new OBPRequestError(data.code, data.message, requestDetails, responseDetails);
			} else {
				throw new OBPRequestError(
					response.status,
					`Error deleting OBP data from ${url}: ${response.statusText}`,
					requestDetails,
					responseDetails
				);
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

		const requestDetails: OBPRequestDetails = {
			method: 'PUT',
			url,
			headers,
			body
		};

		const response = await fetch(url, {
			method: 'PUT',
			headers,
			body: JSON.stringify(body)
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

			const responseDetails: OBPResponseDetails = {
				status: response.status,
				statusText: response.statusText,
				data
			};

			if (data && data.code && data.message) {
				throw new OBPRequestError(data.code, data.message, requestDetails, responseDetails);
			} else {
				throw new OBPRequestError(
					response.status,
					`Error putting OBP data to ${url}: ${response.statusText}`,
					requestDetails,
					responseDetails
				);
			}
		}

		logger.debug('Response from OBP', response.status, response.statusText);
		logger.debug('PUT done');
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

	delete: function (endpoint: string, accessToken?: string) {
		return this.instance.delete(endpoint, accessToken);
	}
};
