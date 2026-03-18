import { createLogger } from '$lib/utils/logger';
import { obp_requests } from '$lib/obp/requests';
import { oauth2ProviderFactory, type WellKnownUri } from '$lib/oauth/providerFactory';
import { PUBLIC_OBP_BASE_URL } from '$env/static/public';

const logger = createLogger('OAuthProviderManager');

export interface ProviderStatus {
	provider: string;
	url?: string;
	status: 'available' | 'unavailable';
	error?: string;
}

interface OAuthProviderStatus {
	ready: boolean;
	error?: any;
	providers: ProviderStatus[];
}

class OAuth2ProviderManager {
	private status: OAuthProviderStatus = {
		ready: false,
		providers: []
	};
	private retryIntervalId: NodeJS.Timeout | null = null;
	private retryIntervalMs: number = 30000; // Retry every 30 seconds
	private refreshIntervalId: NodeJS.Timeout | null = null;
	private refreshIntervalMs: number = 60000; // Refresh provider status every 60 seconds
	private definedProviders: string[] = [];

	constructor() {
		// Initialize with all known/configured providers from the factory
		this.definedProviders = oauth2ProviderFactory.getSupportedProviders();
		this.initializeProviderStatuses();
	}

	/**
	 * Initialize provider statuses for all defined providers
	 */
	private initializeProviderStatuses() {
		this.status.providers = this.definedProviders.map((provider) => ({
			provider,
			status: 'unavailable' as const,
			error: 'Provider not yet checked'
		}));
	}

	/**
	 * Fetches all well-known URIs from the OBP API
	 */
	async fetchWellKnownUris(): Promise<WellKnownUri[]> {
		try {
			const response = await obp_requests.get('/obp/v5.1.0/well-known');
			return response.well_known_uris;
		} catch (error) {
			logger.error('Failed to fetch well-known URIs:', error);
			throw error;
		}
	}

	/**
	 * Initializes all available OAuth2 providers from well-known URIs
	 * Also tracks providers that failed to initialize
	 */
	async initOauth2Providers() {
		const initializedProviders: WellKnownUri[] = [];
		let wellKnownUris: WellKnownUri[] = [];

		try {
			wellKnownUris = await this.fetchWellKnownUris();
			logger.debug('Well-known URIs fetched successfully:', wellKnownUris);
		} catch (error) {
			logger.error('Failed to fetch well-known URIs, marking all providers as unavailable');
			// Mark all defined providers as unavailable due to API connectivity issues
			const errorMessage = error instanceof Error ? error.message : String(error);
			const detailedError = `Unable to fetch provider configuration from OBP API: ${errorMessage}`;
			this.definedProviders.forEach((provider) => {
				const existingProvider = this.status.providers.find((p) => p.provider === provider);
				if (existingProvider) {
					existingProvider.status = 'unavailable';
					existingProvider.error = detailedError;
				}
			});
			throw error;
		}

		// Process each provider from well-known URIs
		for (const providerUri of wellKnownUris) {
			const existingProvider = this.status.providers.find(
				(p) => p.provider === providerUri.provider
			);

			try {
				const oauth2Client = await oauth2ProviderFactory.initializeProvider(providerUri);
				if (oauth2Client) {
					initializedProviders.push(providerUri);
					if (existingProvider) {
						existingProvider.status = 'available';
						existingProvider.url = providerUri.url;
						existingProvider.error = undefined;
					} else {
						this.status.providers.push({
							provider: providerUri.provider,
							url: providerUri.url,
							status: 'available'
						});
					}
					logger.info(`Successfully initialized OAuth2 provider: ${providerUri.provider}`);
				} else {
					if (existingProvider) {
						existingProvider.status = 'unavailable';
						existingProvider.url = providerUri.url;
						existingProvider.error = 'No strategy found for this provider';
					} else {
						this.status.providers.push({
							provider: providerUri.provider,
							url: providerUri.url,
							status: 'unavailable',
							error: 'No strategy found for this provider'
						});
					}
					logger.warn(`No strategy available for provider: ${providerUri.provider}`);
				}
			} catch (error) {
				if (existingProvider) {
					existingProvider.status = 'unavailable';
					existingProvider.url = providerUri.url;
					existingProvider.error = error instanceof Error ? error.message : 'Unknown error';
				} else {
					this.status.providers.push({
						provider: providerUri.provider,
						url: providerUri.url,
						status: 'unavailable',
						error: error instanceof Error ? error.message : 'Unknown error'
					});
				}
				logger.error(`Failed to initialize OAuth2 provider ${providerUri.provider}:`, error);
			}
		}

		// Mark defined providers not found in well-known URIs as unavailable
		for (const definedProvider of this.definedProviders) {
			const foundInWellKnown = wellKnownUris.find((uri) => uri.provider === definedProvider);
			if (!foundInWellKnown) {
				const existingProvider = this.status.providers.find((p) => p.provider === definedProvider);
				if (existingProvider) {
					existingProvider.status = 'unavailable';
					existingProvider.error = 'Provider not configured in OBP API well-known endpoints';
				}
			}
		}

		const availableCount = this.status.providers.filter((p) => p.status === 'available').length;
		const unavailableCount = this.status.providers.filter((p) => p.status === 'unavailable').length;

		logger.info(
			`OAuth2 Provider Summary: ${availableCount} available, ${unavailableCount} unavailable`
		);

		if (availableCount === 0) {
			logger.error(
				'Could not initialize any OAuth2 provider. Please check your OBP configuration.'
			);
			throw new Error('No OAuth2 providers could be initialized');
		}

		if (availableCount === 1) {
			const availableProvider = this.status.providers.find((p) => p.status === 'available');
			logger.info(`Single OAuth2 provider available: ${availableProvider?.provider}`);
		}

		if (availableCount > 1) {
			const availableProviders = this.status.providers
				.filter((p) => p.status === 'available')
				.map((p) => p.provider);
			logger.info(`Multiple OAuth2 providers available: ${availableProviders.join(', ')}`);
		}

		return initializedProviders;
	}

	/**
	 * Attempts to initialize OAuth2 providers and updates status
	 */
	async tryInitOauth2Providers() {
		try {
			const providers = await this.initOauth2Providers();
			this.status.ready = providers.length > 0;
			this.status.error = null;

			if (this.status.ready) {
				logger.info('OAuth2 providers initialized successfully.');
				if (this.retryIntervalId) {
					clearInterval(this.retryIntervalId);
					this.retryIntervalId = null;
				}
				// Start periodic refresh to check for provider status changes
				this.startPeriodicRefresh();
			}

			return providers;
		} catch (error) {
			this.status.ready = false;
			this.status.error = error;
			logger.error('Error initializing OAuth2 providers:', error);
			return [];
		}
	}

	/**
	 * Starts the initialization process with automatic retry
	 */
	async start() {
		await this.tryInitOauth2Providers();

		// Start retry interval if initialization failed
		if (!this.status.ready && !this.retryIntervalId) {
			this.retryIntervalId = setInterval(async () => {
				if (!this.status.ready) {
					logger.info('Retrying OAuth2 providers initialization...');
					await this.tryInitOauth2Providers();
				}
			}, this.retryIntervalMs);
		} else if (this.status.ready) {
			// Start periodic refresh for status monitoring
			this.startPeriodicRefresh();
		}
	}

	/**
	 * Returns all providers with their status
	 */
	getAllProviders(): ProviderStatus[] {
		return [...this.status.providers];
	}

	/**
	 * Returns only available providers
	 */
	getAvailableProviders(): ProviderStatus[] {
		return this.status.providers.filter((p) => p.status === 'available');
	}

	/**
	 * Returns only unavailable providers
	 */
	getUnavailableProviders(): ProviderStatus[] {
		return this.status.providers.filter((p) => p.status === 'unavailable');
	}

	/**
	 * Returns the legacy initialized providers format for backward compatibility
	 */
	getInitializedProviders(): WellKnownUri[] {
		return this.getAvailableProviders()
			.filter((p) => p.url)
			.map((p) => ({
				provider: p.provider,
				url: p.url!
			}));
	}

	/**
	 * Returns if the OAuth2 providers are ready
	 */
	isReady(): boolean {
		return this.status.ready;
	}

	/**
	 * Returns a list of health check entries for the available providers
	 */
	getHealthCheckEntries() {
		return this.getAvailableProviders()
			.filter((p) => p.url)
			.map((p) => ({
				serviceName: `OAuth2: ${p.provider}`,
				url: p.url!
			}));
	}

	/**
	 * Returns the number of available providers
	 */
	getProviderCount(): number {
		return this.getAvailableProviders().length;
	}

	/**
	 * Returns true if there's exactly one available provider
	 */
	hasSingleProvider(): boolean {
		return this.getProviderCount() === 1;
	}

	/**
	 * Returns true if there are multiple available providers
	 */
	hasMultipleProviders(): boolean {
		return this.getProviderCount() > 1;
	}

	/**
	 * Starts periodic refresh to monitor provider status changes
	 */
	private startPeriodicRefresh() {
		if (this.refreshIntervalId) {
			return; // Already started
		}

		this.refreshIntervalId = setInterval(async () => {
			logger.debug('Refreshing OAuth2 provider statuses...');
			try {
				await this.initOauth2Providers();
			} catch (error) {
				logger.warn('Provider status refresh failed:', error);
			}
		}, this.refreshIntervalMs);

		logger.info(`Started periodic provider status refresh every ${this.refreshIntervalMs}ms`);
	}

	/**
	 * Cleans up resources, like the retry and refresh intervals
	 */
	shutdown() {
		if (this.retryIntervalId) {
			clearInterval(this.retryIntervalId);
			this.retryIntervalId = null;
		}
		if (this.refreshIntervalId) {
			clearInterval(this.refreshIntervalId);
			this.refreshIntervalId = null;
		}
	}
}

export const oauth2ProviderManager = new OAuth2ProviderManager();
