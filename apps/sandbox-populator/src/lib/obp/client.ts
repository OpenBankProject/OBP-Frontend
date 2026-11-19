import { createLogger } from '$lib/utils/logger';
import type {
	Bank,
	BanksResponse,
	CreateBankPayload,
	Account,
	AccountsResponse,
	CreateAccountPayload,
	Counterparty,
	CounterpartiesResponse,
	CreateCounterpartyPayload,
	FxRate,
	CreateFxRatePayload,
	Transaction,
	CreateHistoricalTransactionPayload,
	TransactionRequest,
	CreateTransactionRequestPayload,
	CreateTransactionRequestCounterpartyPayload,
	Customer,
	CustomersResponse,
	CreateCustomerPayload,
	CreateCorporateCustomerPayload,
	UserCustomerLink,
	UserCustomerLinksResponse,
	CreateUserCustomerLinkPayload,
	CustomerLink,
	CreateCustomerLinkPayload,
	CustomerAccountLink,
	CreateCustomerAccountLinkPayload,
	PersonalDataField,
	PersonalDataFieldsResponse,
	CreatePersonalDataFieldPayload,
	User,
	CreateUserPayload,
	CreateUserResponse,
	AppDirectoryEntry,
	AppDirectoryResponse
} from './types';

const logger = createLogger('OBPClient');

/** OBP-API's address, or a clear error when PUBLIC_OBP_BASE_URL is not set. */
export function requireObpBaseUrl(baseUrl: string | undefined): string {
	if (!baseUrl) throw new Error('PUBLIC_OBP_BASE_URL is not set');
	return baseUrl;
}

export class OBPClient {
	private baseUrl: string;
	private apiVersion: string;
	private accessToken: string;

	constructor(baseUrl: string | undefined, apiVersion: string, accessToken: string) {
		this.baseUrl = requireObpBaseUrl(baseUrl);
		this.apiVersion = apiVersion;
		this.accessToken = accessToken;
	}

	private url(path: string): string {
		return `${this.baseUrl}/obp/${this.apiVersion}${path}`;
	}

	private async handleResponse<T>(response: Response): Promise<T> {
		const data = await response.json();
		if (!response.ok) {
			const errorMsg = data.message || `API Error ${response.status}: ${response.statusText}`;
			logger.error('OBP API Error:', errorMsg);
			throw new Error(errorMsg);
		}
		return data as T;
	}

	private getHeaders(): Record<string, string> {
		return {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${this.accessToken}`
		};
	}

	// App Directory (no auth required)
	static async getAppDirectory(baseUrl: string | undefined, apiVersion: string): Promise<AppDirectoryEntry[]> {
		const response = await fetch(`${requireObpBaseUrl(baseUrl)}/obp/${apiVersion}/app-directory`);
		if (!response.ok) {
			logger.error('Failed to fetch app directory');
			return [];
		}
		const data: AppDirectoryResponse = await response.json();
		return data.app_directory || [];
	}

	// User endpoints
	async createUser(payload: CreateUserPayload): Promise<CreateUserResponse> {
		const response = await fetch(this.url('/users'), {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(payload)
		});
		return this.handleResponse<CreateUserResponse>(response);
	}

	async getCurrentUser(): Promise<User> {
		const response = await fetch(this.url('/users/current'), {
			headers: this.getHeaders()
		});
		return this.handleResponse<User>(response);
	}

	// Bank endpoints
	private validateBank(bank: any): Bank {
		if (!bank.bank_id) {
			throw new Error(`Invalid bank response: missing bank_id. Received: ${JSON.stringify(bank)}`);
		}
		return bank as Bank;
	}

	async getBanks(): Promise<BanksResponse> {
		const response = await fetch(this.url('/banks'), {
			headers: this.getHeaders()
		});
		const data = await this.handleResponse<{ banks: any[] }>(response);
		return {
			banks: data.banks.map((bank) => this.validateBank(bank))
		};
	}

	async getBank(bankId: string): Promise<Bank> {
		const response = await fetch(this.url(`/banks/${bankId}`), {
			headers: this.getHeaders()
		});
		const bank = await this.handleResponse<any>(response);
		return this.validateBank(bank);
	}

	async createBank(payload: CreateBankPayload): Promise<Bank> {
		const body = {
			bank_id: payload.bank_id,
			full_name: payload.full_name,
			bank_code: payload.bank_code,
			logo: payload.logo || '',
			website: payload.website || '',
			bank_routings: payload.bank_routings || []
		};

		const response = await fetch(this.url('/banks'), {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(body)
		});
		const bank = await this.handleResponse<any>(response);
		return this.validateBank(bank);
	}

	async bankExists(bankId: string): Promise<boolean> {
		const response = await fetch(this.url(`/banks/${bankId}`), {
			headers: this.getHeaders()
		});
		return response.ok;
	}

	// Entitlement endpoints
	async createEntitlement(userId: string, bankId: string, roleName: string): Promise<{ entitlement_id: string; role_name: string; bank_id: string }> {
		const response = await fetch(this.url(`/users/${userId}/entitlements`), {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify({
				bank_id: bankId,
				role_name: roleName
			})
		});
		return this.handleResponse(response);
	}

	// Account endpoints
	async getMyAccounts(): Promise<Account[]> {
		const response = await fetch(this.url('/my/accounts'), {
			headers: this.getHeaders()
		});
		const data = await this.handleResponse<{ accounts: Account[] }>(response);
		return data.accounts;
	}

	async getAccountsAtBank(bankId: string): Promise<AccountsResponse> {
		const response = await fetch(this.url(`/banks/${bankId}/accounts`), {
			headers: this.getHeaders()
		});
		return this.handleResponse<AccountsResponse>(response);
	}

	async createAccount(bankId: string, payload: CreateAccountPayload): Promise<Account> {
		const body = {
			label: payload.label,
			currency: payload.currency,
			balance: payload.balance,
			user_id: payload.user_id,
			product_code: payload.product_code || '',
			branch_id: payload.branch_id || '',
			account_routings: payload.account_routings || []
		};

		const response = await fetch(this.url(`/banks/${bankId}/accounts`), {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(body)
		});
		return this.handleResponse<Account>(response);
	}

	// Counterparty endpoints
	async getCounterparties(
		bankId: string,
		accountId: string,
		viewId: string = 'owner'
	): Promise<CounterpartiesResponse> {
		const response = await fetch(
			this.url(`/banks/${bankId}/accounts/${accountId}/${viewId}/counterparties`),
			{
				headers: this.getHeaders()
			}
		);
		return this.handleResponse<CounterpartiesResponse>(response);
	}

	async createCounterparty(
		bankId: string,
		accountId: string,
		payload: CreateCounterpartyPayload,
		viewId: string = 'owner'
	): Promise<Counterparty> {
		const body = {
			name: payload.name,
			description: payload.description,
			currency: payload.currency,
			other_account_routing_scheme: payload.other_account_routing_scheme || 'IBAN',
			other_account_routing_address: payload.other_account_routing_address || '',
			other_account_secondary_routing_scheme:
				payload.other_account_secondary_routing_scheme || '',
			other_account_secondary_routing_address:
				payload.other_account_secondary_routing_address || '',
			other_bank_routing_scheme: payload.other_bank_routing_scheme || 'BIC',
			other_bank_routing_address: payload.other_bank_routing_address || '',
			other_branch_routing_scheme: payload.other_branch_routing_scheme || '',
			other_branch_routing_address: payload.other_branch_routing_address || '',
			is_beneficiary: payload.is_beneficiary ?? true,
			bespoke: payload.bespoke || []
		};

		const response = await fetch(
			this.url(`/banks/${bankId}/accounts/${accountId}/${viewId}/counterparties`),
			{
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify(body)
			}
		);
		return this.handleResponse<Counterparty>(response);
	}

	// FX Rate endpoints
	async getCurrenciesAtBank(bankId: string): Promise<string[]> {
		const response = await fetch(this.url(`/banks/${bankId}/currencies`), {
			headers: this.getHeaders()
		});
		const data = await this.handleResponse<{ currencies: Array<{ currency_code: string }> }>(response);
		return data.currencies.map(c => c.currency_code);
	}

	async getFxRate(bankId: string, fromCurrency: string, toCurrency: string): Promise<FxRate | null> {
		try {
			const response = await fetch(this.url(`/banks/${bankId}/fx/${fromCurrency}/${toCurrency}`), {
				headers: this.getHeaders()
			});
			return await this.handleResponse<FxRate>(response);
		} catch {
			return null;
		}
	}

	/** The bank comes from bankId, so the payload does not repeat it. */
	async createFxRate(bankId: string, payload: Omit<CreateFxRatePayload, 'bank_id'>): Promise<FxRate> {
		const body: Record<string, any> = {
			bank_id: bankId,
			from_currency_code: payload.from_currency_code,
			to_currency_code: payload.to_currency_code,
			conversion_value: payload.conversion_value,
			inverse_conversion_value:
				payload.inverse_conversion_value || 1.0 / payload.conversion_value
		};
		if (payload.effective_date) {
			body.effective_date = payload.effective_date;
		}

		const response = await fetch(this.url(`/banks/${bankId}/fx`), {
			method: 'PUT',
			headers: this.getHeaders(),
			body: JSON.stringify(body)
		});
		return this.handleResponse<FxRate>(response);
	}

	// Historical Transaction endpoints
	async createHistoricalTransaction(
		bankId: string,
		payload: CreateHistoricalTransactionPayload
	): Promise<Transaction> {
		const body = {
			from_account_id: payload.from_account_id,
			to_account_id: payload.to_account_id,
			value: payload.value,
			description: payload.description,
			posted: payload.posted,
			completed: payload.completed,
			type: payload.type || 'SANDBOX_TAN',
			charge_policy: payload.charge_policy || 'SHARED'
		};

		const response = await fetch(this.url(`/banks/${bankId}/management/historical/transactions`), {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(body)
		});
		return this.handleResponse<Transaction>(response);
	}

	// Transaction endpoints
	async getTransactionsForAccount(
		bankId: string,
		accountId: string,
		viewId: string = 'owner'
	): Promise<Transaction[]> {
		const response = await fetch(
			this.url(`/banks/${bankId}/accounts/${accountId}/${viewId}/transactions`),
			{
				headers: this.getHeaders()
			}
		);
		const data = await this.handleResponse<{ transactions: Transaction[] }>(response);
		return data.transactions || [];
	}

	// Transaction Request endpoints
	async getTransactionRequestsForAccount(
		bankId: string,
		accountId: string,
		viewId: string = 'owner'
	): Promise<TransactionRequest[]> {
		const response = await fetch(
			this.url(`/banks/${bankId}/accounts/${accountId}/${viewId}/transaction-requests`),
			{
				headers: this.getHeaders()
			}
		);
		const data = await this.handleResponse<{ transaction_requests: TransactionRequest[] }>(response);
		return data.transaction_requests || [];
	}

	async createTransactionRequest(
		fromBankId: string,
		fromAccountId: string,
		payload: CreateTransactionRequestPayload,
		viewId: string = 'owner'
	): Promise<TransactionRequest> {
		const response = await fetch(
			this.url(
				`/banks/${fromBankId}/accounts/${fromAccountId}/${viewId}/transaction-request-types/ACCOUNT/transaction-requests`
			),
			{
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify(payload)
			}
		);
		return this.handleResponse<TransactionRequest>(response);
	}

	async createTransactionRequestCounterparty(
		fromBankId: string,
		fromAccountId: string,
		payload: CreateTransactionRequestCounterpartyPayload,
		viewId: string = 'owner'
	): Promise<TransactionRequest> {
		const response = await fetch(
			this.url(
				`/banks/${fromBankId}/accounts/${fromAccountId}/${viewId}/transaction-request-types/COUNTERPARTY/transaction-requests`
			),
			{
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify(payload)
			}
		);
		return this.handleResponse<TransactionRequest>(response);
	}

	// Customer endpoints
	async getCustomersAtBank(bankId: string): Promise<CustomersResponse> {
		const response = await fetch(this.url(`/banks/${bankId}/customers`), {
			headers: this.getHeaders()
		});
		return this.handleResponse<CustomersResponse>(response);
	}

	async getCorporateCustomersAtBank(bankId: string): Promise<CustomersResponse> {
		const response = await fetch(this.url(`/banks/${bankId}/corporate-customers`), {
			headers: this.getHeaders()
		});
		return this.handleResponse<CustomersResponse>(response);
	}

	async createCustomer(bankId: string, payload: CreateCustomerPayload): Promise<Customer> {
		const response = await fetch(this.url(`/banks/${bankId}/customers`), {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(payload)
		});
		return this.handleResponse<Customer>(response);
	}

	async createCorporateCustomer(bankId: string, payload: CreateCorporateCustomerPayload): Promise<Customer> {
		const response = await fetch(this.url(`/banks/${bankId}/corporate-customers`), {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(payload)
		});
		return this.handleResponse<Customer>(response);
	}

	// User Customer Link endpoints
	async getUserCustomerLinksByUserId(bankId: string, userId: string): Promise<UserCustomerLinksResponse> {
		const response = await fetch(this.url(`/banks/${bankId}/user_customer_links/users/${userId}`), {
			headers: this.getHeaders()
		});
		return this.handleResponse<UserCustomerLinksResponse>(response);
	}

	async createUserCustomerLink(bankId: string, payload: CreateUserCustomerLinkPayload): Promise<UserCustomerLink> {
		const response = await fetch(this.url(`/banks/${bankId}/user_customer_links`), {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(payload)
		});
		return this.handleResponse<UserCustomerLink>(response);
	}

	// Customer Link endpoints (customer-to-customer relationships)
	async createCustomerLink(bankId: string, payload: CreateCustomerLinkPayload): Promise<CustomerLink> {
		const response = await fetch(this.url(`/banks/${bankId}/customer-links`), {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(payload)
		});
		return this.handleResponse<CustomerLink>(response);
	}

	// Customer Account Link endpoints
	async createCustomerAccountLink(bankId: string, payload: CreateCustomerAccountLinkPayload): Promise<CustomerAccountLink> {
		const response = await fetch(this.url(`/banks/${bankId}/customer-account-links`), {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(payload)
		});
		return this.handleResponse<CustomerAccountLink>(response);
	}

	// Personal Data Field endpoints
	async getPersonalDataFields(): Promise<PersonalDataFieldsResponse> {
		const response = await fetch(this.url('/my/personal-data-fields'), {
			headers: this.getHeaders()
		});
		return this.handleResponse<PersonalDataFieldsResponse>(response);
	}

	async createPersonalDataField(payload: CreatePersonalDataFieldPayload): Promise<PersonalDataField> {
		const response = await fetch(this.url('/my/personal-data-fields'), {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(payload)
		});
		return this.handleResponse<PersonalDataField>(response);
	}

	async updatePersonalDataField(attributeId: string, payload: CreatePersonalDataFieldPayload): Promise<PersonalDataField> {
		const response = await fetch(this.url(`/my/personal-data-fields/${attributeId}`), {
			method: 'PUT',
			headers: this.getHeaders(),
			body: JSON.stringify(payload)
		});
		return this.handleResponse<PersonalDataField>(response);
	}
}
