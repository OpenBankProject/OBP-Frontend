// Bank Types
export interface Bank {
	bank_id: string;
	bank_code: string;
	full_name: string;
	logo: string | null;
	website: string | null;
	bank_routings: BankRouting[];
	attributes?: any[];
}

export interface BankRouting {
	scheme: string;
	address: string;
}

export interface BanksResponse {
	banks: Bank[];
}

export interface CreateBankPayload {
	bank_id: string;
	full_name: string;
	bank_code: string;
	logo?: string;
	website?: string;
	bank_routings?: BankRouting[];
}

// Account Types
export interface Account {
	account_id: string;
	bank_id: string;
	label: string;
	currency: string;
	balance: AccountBalance;
	product_code?: string;
	branch_id?: string;
	account_routings: AccountRouting[];
}

export interface AccountBalance {
	amount: string;
	currency: string;
}

export interface AccountRouting {
	scheme: string;
	address: string;
}

export interface AccountsResponse {
	accounts: Account[];
}

export interface CreateAccountPayload {
	label: string;
	currency: string;
	balance: AccountBalance;
	user_id?: string;
	product_code?: string;
	branch_id?: string;
	account_routings?: AccountRouting[];
}

// Counterparty Types
export interface Counterparty {
	counterparty_id: string;
	name: string;
	description: string;
	currency: string;
	other_account_routing_scheme: string;
	other_account_routing_address: string;
	other_bank_routing_scheme: string;
	other_bank_routing_address: string;
	is_beneficiary: boolean;
	bespoke: BespokeField[];
}

export interface BespokeField {
	key: string;
	value: string;
}

export interface CounterpartiesResponse {
	counterparties: Counterparty[];
}

export interface CreateCounterpartyPayload {
	name: string;
	description: string;
	currency: string;
	other_account_routing_scheme?: string;
	other_account_routing_address?: string;
	other_account_secondary_routing_scheme?: string;
	other_account_secondary_routing_address?: string;
	other_bank_routing_scheme?: string;
	other_bank_routing_address?: string;
	other_branch_routing_scheme?: string;
	other_branch_routing_address?: string;
	is_beneficiary?: boolean;
	bespoke?: BespokeField[];
}

// FX Rate Types
export interface FxRate {
	bank_id: string;
	from_currency_code: string;
	to_currency_code: string;
	conversion_value: number;
	inverse_conversion_value: number;
	effective_date: string;
}

export interface CreateFxRatePayload {
	bank_id: string;
	from_currency_code: string;
	to_currency_code: string;
	conversion_value: number;
	inverse_conversion_value?: number;
	effective_date: string;
}

// Transaction Types
export interface Transaction {
	transaction_id: string;
	this_account: TransactionAccount;
	other_account: TransactionAccount;
	details: TransactionDetails;
}

export interface TransactionAccount {
	id: string;
	bank_id?: string;
}

export interface TransactionDetails {
	type: string;
	description: string;
	posted: string;
	completed: string;
	value: TransactionValue;
}

export interface TransactionValue {
	currency: string;
	amount: string;
}

export interface CreateHistoricalTransactionPayload {
	from_account_id: string;
	to_account_id: string;
	value: TransactionValue;
	description: string;
	posted: string;
	completed: string;
	type?: string;
	charge_policy?: string;
}

// Transaction Request Types
export interface TransactionRequest {
	id: string;
	type: string;
	from: TransactionAccount;
	details: TransactionRequestDetails;
	status: string;
}

export interface TransactionRequestDetails {
	to_sandbox_tan?: {
		bank_id: string;
		account_id: string;
	};
	value: TransactionValue;
	description: string;
}

export interface CreateTransactionRequestPayload {
	to: {
		bank_id: string;
		account_id: string;
	};
	value: TransactionValue;
	description: string;
}

export interface CreateTransactionRequestCounterpartyPayload {
	to: {
		counterparty_id: string;
	};
	value: TransactionValue;
	description: string;
	charge_policy?: string;
}

// Customer Types
export interface Customer {
	bank_id: string;
	customer_id: string;
	customer_number: string;
	legal_name: string;
	mobile_phone_number: string;
	email: string;
	date_of_birth: string;
	relationship_status: string;
	dependants: number;
	dob_of_dependants: string[];
	credit_rating: { rating: string; source: string };
	credit_limit: { currency: string; amount: string };
	highest_education_attained: string;
	employment_status: string;
	kyc_status: boolean;
	last_ok_date: string;
	title: string;
	branch_id: string;
	name_suffix: string;
	customer_type: string;
	parent_customer_id: string;
}

export interface CustomersResponse {
	customers: Customer[];
}

export interface CreateCustomerPayload {
	legal_name: string;
	mobile_phone_number: string;
	customer_number?: string;
	email?: string;
	date_of_birth?: string;
	relationship_status?: string;
	dependants?: number;
	dob_of_dependants?: string[];
	credit_rating?: { rating: string; source: string };
	credit_limit?: { currency: string; amount: string };
	highest_education_attained?: string;
	employment_status?: string;
	kyc_status?: boolean;
	last_ok_date?: string;
	title?: string;
	branch_id?: string;
	name_suffix?: string;
}

export interface CreateCorporateCustomerPayload {
	legal_name: string;
	mobile_phone_number: string;
	customer_number?: string;
	email?: string;
	credit_rating?: { rating: string; source: string };
	credit_limit?: { currency: string; amount: string };
	kyc_status?: boolean;
	last_ok_date?: string;
	branch_id?: string;
	customer_type?: string;
	parent_customer_id?: string;
	category?: string;
}

// User Customer Link Types
export interface UserCustomerLink {
	user_customer_link_id: string;
	customer_id: string;
	user_id: string;
	date_inserted: string;
	is_active: boolean;
}

export interface UserCustomerLinksResponse {
	user_customer_links: UserCustomerLink[];
}

export interface CreateUserCustomerLinkPayload {
	user_id: string;
	customer_id: string;
}

// Customer Link Types (customer-to-customer relationships)
export interface CustomerLink {
	customer_link_id: string;
	bank_id: string;
	customer_id: string;
	other_bank_id: string;
	other_customer_id: string;
	relationship_to: string;
	date_inserted: string;
	date_updated: string;
}

export interface CreateCustomerLinkPayload {
	customer_id: string;
	other_bank_id: string;
	other_customer_id: string;
	relationship_to: string;
}

// Customer Account Link Types
export interface CustomerAccountLink {
	customer_account_link_id: string;
	customer_id: string;
	bank_id: string;
	account_id: string;
	relationship_type: string;
}

export interface CreateCustomerAccountLinkPayload {
	customer_id: string;
	bank_id: string;
	account_id: string;
	relationship_type: string;
}

// Personal Data Field Types
export interface PersonalDataField {
	user_attribute_id: string;
	name: string;
	type: string;
	value: string;
	is_personal: boolean;
	insert_date: string;
}

export interface PersonalDataFieldsResponse {
	user_attributes: PersonalDataField[];
}

export interface CreatePersonalDataFieldPayload {
	name: string;
	type: string;
	value: string;
}

// App Directory Types
export interface AppDirectoryEntry {
	name: string;
	value: string;
}

export interface AppDirectoryResponse {
	app_directory: AppDirectoryEntry[];
}

// User Types
export interface User {
	user_id: string;
	email: string;
	username: string;
	entitlements: {
		list: Array<{
			entitlement_id: string;
			role_name: string;
			bank_id: string;
		}>;
	};
	views: {
		list: object[];
	};
}

export interface CreateUserPayload {
	email: string;
	username: string;
	password: string;
	first_name: string;
	last_name: string;
}

export interface CreateUserResponse {
	user_id: string;
	email: string;
	provider_id: string;
	provider: string;
	username: string;
	entitlements: {
		list: Array<{
			entitlement_id: string;
			role_name: string;
			bank_id: string;
		}>;
	};
}
