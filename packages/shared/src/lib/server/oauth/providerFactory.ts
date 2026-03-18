import { createLogger } from '$lib/utils/logger';
const logger = createLogger('OAuthProviderFactory');
import { OAuth2ClientWithConfig } from './client';

export interface WellKnownUri {
	provider: string;
	url: string;
}

export interface OAuthProviderConfig {
	clientId: string;
	clientSecret: string;
	callbackUrl: string;
}

// Implement this for other OAuth2 providers as needed
// Then register them in the OAuth2ProviderFactory
interface OAuth2ProviderStrategy {
	providerName: string;
	initialize(config: WellKnownUri): Promise<OAuth2ClientWithConfig>;
	supports(provider: string): boolean;
	getProviderName(): string;
}

export class KeyCloakStrategy implements OAuth2ProviderStrategy {
	providerName = 'keycloak';
	private config: OAuthProviderConfig;

	constructor(config: OAuthProviderConfig) {
		this.config = config;
	}

	supports(provider: string): boolean {
		return provider === this.providerName;
	}

	getProviderName(): string {
		return this.providerName;
	}

	async initialize(config: WellKnownUri): Promise<OAuth2ClientWithConfig> {
		const client = new OAuth2ClientWithConfig(
			this.config.clientId,
			this.config.clientSecret,
			this.config.callbackUrl,
			'keycloak'
		);

		await client.initOIDCConfig(config.url);

		return client;
	}
}

export class OBPOIDCStrategy implements OAuth2ProviderStrategy {
	providerName = 'obp-oidc';
	private config: OAuthProviderConfig;

	constructor(config: OAuthProviderConfig) {
		this.config = config;
	}

	supports(provider: string): boolean {
		return provider === this.providerName;
	}

	getProviderName(): string {
		return this.providerName;
	}

	async initialize(config: WellKnownUri): Promise<OAuth2ClientWithConfig> {
		logger.debug(`Initializing OAuth client with:`, {
			clientId: this.config.clientId ? '[SET]' : '[MISSING]',
			clientSecret: this.config.clientSecret ? '[SET]' : '[MISSING]',
			callbackUrl: this.config.callbackUrl ? this.config.callbackUrl : '[MISSING]',
			configUrl: config.url
		});

		const client = new OAuth2ClientWithConfig(
			this.config.clientId,
			this.config.clientSecret,
			this.config.callbackUrl,
			'obp-oidc'
		);

		await client.initOIDCConfig(config.url);

		return client;
	}
}

export class OAuth2ProviderFactory {
	private strategies: OAuth2ProviderStrategy[] = [];
	private initializedClients = new Map<string, OAuth2ClientWithConfig>();

	constructor(strategies?: OAuth2ProviderStrategy[]) {
		if (strategies) {
			strategies.forEach(s => this.registerStrategy(s));
		}
	}

	registerStrategy(strategy: OAuth2ProviderStrategy): void {
		this.strategies.push(strategy);
	}

	getStrategy(provider: string): OAuth2ProviderStrategy | undefined {
		return this.strategies.find((strategy) => strategy.supports(provider));
	}

	async initializeProvider(config: WellKnownUri): Promise<OAuth2ClientWithConfig | null> {
		if (!config.provider || !config.url) {
			throw new Error(`Invalid configuration for OAuth2 provider: ${JSON.stringify(config)}`);
		}

		const strategy = this.getStrategy(config.provider);

		if (!strategy) {
			logger.warn(`No strategy found for provider: ${config.provider}`);
			return null;
		}

		try {
			const client = await strategy.initialize(config);
			this.initializedClients.set(config.provider, client);
			logger.debug(`Initialized OAuth2 client for provider: ${config.provider}`);
			return client;
		} catch (error) {
			logger.error(`Failed to initialize OAuth2 client for provider ${config.provider}:`, error);
			throw error;
		}
	}

	getPrimaryClient(): OAuth2ClientWithConfig | undefined {
		// Return the first initialized client as the primary client
		return this.initializedClients.values().next().value;
	}

	getClientCount(): number {
		return this.initializedClients.size;
	}

	hasAnyClients(): boolean {
		return this.initializedClients.size > 0;
	}

	getClient(provider: string): OAuth2ClientWithConfig | undefined {
		return this.initializedClients.get(provider);
	}

	getAllClients(): Map<string, OAuth2ClientWithConfig> {
		return new Map(this.initializedClients);
	}

	getSupportedProviders(): string[] {
		return this.strategies.map((strategy) => strategy.getProviderName());
	}

	getFirstAvailableProvider(): string | null {
		const providers = Array.from(this.initializedClients.keys());
		return providers.length > 0 ? providers[0] : null;
	}
}
