import { createLogger } from '$lib/utils/logger';
const logger = createLogger('PopulateServer');
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { OBPClient } from '$lib/obp/client';
import { env } from '$env/dynamic/public';
import {
	COUNTRY_LIST,
	getCountryConfig,
	getCaseExample,
	getBusinesses,
	getBusinessForCounterparty,
	getIndividualCustomers,
	getCorporateCustomers,
	toCreateCustomerPayload,
	toCreateCorporateCustomerPayload
} from '$lib/data/countries';

// FX rates for African currencies and others (relative to BWP)
const FX_RATES: Record<string, number> = {
	EUR: 0.068, // 1 BWP = 0.068 EUR
	USD: 0.074, // 1 BWP = 0.074 USD
	GBP: 0.058, // 1 BWP = 0.058 GBP
	ZAR: 1.37, // 1 BWP = 1.37 ZAR
	KES: 11.5, // 1 BWP = 11.5 KES
	NGN: 115, // 1 BWP = 115 NGN
	EGP: 2.28, // 1 BWP = 2.28 EGP
	GHS: 0.92, // 1 BWP = 0.92 GHS
	TZS: 186, // 1 BWP = 186 TZS
	UGX: 275, // 1 BWP = 275 UGX
	ZMW: 1.88, // 1 BWP = 1.88 ZMW
	NAD: 1.37, // 1 BWP = 1.37 NAD
	CNY: 0.53, // 1 BWP = 0.53 CNY
	JPY: 11.2, // 1 BWP = 11.2 JPY
	SGD: 0.099, // 1 BWP = 0.099 SGD
	OMR: 0.0285 // 1 BWP = 0.0285 OMR
};

// Target currencies for FX rates
const TARGET_CURRENCIES = Object.keys(FX_RATES);
const BASE_CURRENCY = 'BWP';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.session?.data?.user;
	const accessToken = locals.session?.data?.oauth?.access_token;
	const username = user?.username || 'unknown';
	const defaultPrefix = getUsernamePrefix(username);

	// Try to load saved settings from OBP Personal Data Fields, then session
	let bankIdPrefix = defaultPrefix;
	let countryCode = 'BW';
	let currency = 'BWP';
	if (accessToken) {
		const client = new OBPClient(env.PUBLIC_OBP_BASE_URL, accessToken);
		try {
			const fields = await client.getPersonalDataFields();
			const attrs = fields.user_attributes || [];
			const savedPrefix = attrs.find((f) => f.name === 'sandbox_populator_last_bank_id_prefix');
			if (savedPrefix?.value) bankIdPrefix = savedPrefix.value;
			const savedCountry = attrs.find((f) => f.name === 'sandbox_populator_last_country');
			if (savedCountry?.value) countryCode = savedCountry.value;
			const savedCurrency = attrs.find((f) => f.name === 'sandbox_populator_last_currency');
			if (savedCurrency?.value) currency = savedCurrency.value;
		} catch (e) {
			logger.warn('Could not load personal data fields');
		}
	}
	// Fall back to session if OBP didn't have it
	if (bankIdPrefix === defaultPrefix) {
		const sessionPrefix = locals.session?.data?.sandbox_populator_last_bank_id_prefix;
		if (sessionPrefix) bankIdPrefix = sessionPrefix;
	}

	// Initialize existing data structure
	const existing = {
		banks: [] as Array<{ bank_id: string; bank_code: string; full_name: string }>,
		accounts: [] as Array<{ account_id: string; bank_id: string; label: string; currency: string }>,
		counterparties: [] as Array<{ counterparty_id: string; name: string; bank_id: string; account_id: string }>,
		customers: [] as Array<{ customer_id: string; legal_name: string; customer_type: string; bank_id: string }>,
		fxRates: [] as Array<{ bank_id: string; from_currency: string; to_currency: string; rate: number }>,
		transactions: [] as Array<{ transaction_id: string; bank_id: string; from_account_id: string; to_account_id: string; amount: string }>
	};

	if (accessToken) {
		const client = new OBPClient(env.PUBLIC_OBP_BASE_URL, accessToken);

		try {
			// Find banks matching user's prefix pattern
			const banksResponse = await client.getBanks();
			const userBanks = banksResponse.banks.filter(b => b.bank_id.startsWith(bankIdPrefix + '-'));

			for (const bank of userBanks) {
				existing.banks.push({
					bank_id: bank.bank_id,
					bank_code: bank.bank_code,
					full_name: bank.full_name
				});

				// Get accounts for this bank (v6.0.0 returns account_id)
				try {
					const accountsResponse = await client.getAccountsAtBank(bank.bank_id);
					const accounts = accountsResponse.accounts || [];
					for (const account of accounts) {
						existing.accounts.push({
							account_id: account.account_id,
							bank_id: bank.bank_id,
							label: account.label || '',
							currency: account.currency || ''
						});
					}
				} catch (e) {
					logger.warn(`Could not fetch accounts for ${bank.bank_id}`);
				}

				// Get FX rates for this bank
				for (const targetCurrency of TARGET_CURRENCIES) {
					const forwardRate = await client.getFxRate(bank.bank_id, BASE_CURRENCY, targetCurrency);
					if (forwardRate) {
						existing.fxRates.push({
							bank_id: bank.bank_id,
							from_currency: BASE_CURRENCY,
							to_currency: targetCurrency,
							rate: forwardRate.conversion_value
						});
					}
					const reverseRate = await client.getFxRate(bank.bank_id, targetCurrency, BASE_CURRENCY);
					if (reverseRate) {
						existing.fxRates.push({
							bank_id: bank.bank_id,
							from_currency: targetCurrency,
							to_currency: BASE_CURRENCY,
							rate: reverseRate.conversion_value
						});
					}
				}
			}

			// Get counterparties for first account
			if (existing.accounts.length > 0) {
				const firstAccount = existing.accounts[0];
				try {
					const cpResponse = await client.getCounterparties(firstAccount.bank_id, firstAccount.account_id);
					for (const cp of cpResponse.counterparties || []) {
						existing.counterparties.push({
							counterparty_id: cp.counterparty_id,
							name: cp.name,
							bank_id: firstAccount.bank_id,
							account_id: firstAccount.account_id
						});
					}
				} catch (e) {
					logger.warn(`Could not fetch counterparties`);
				}

				// Get individual customers for this bank
				try {
					const customersResponse = await client.getCustomersAtBank(firstAccount.bank_id);
					for (const cust of customersResponse.customers || []) {
						existing.customers.push({
							customer_id: cust.customer_id,
							legal_name: cust.legal_name,
							customer_type: 'INDIVIDUAL',
							bank_id: firstAccount.bank_id
						});
					}
				} catch (e) {
					logger.warn(`Could not fetch individual customers`);
				}

				// Get corporate customers for this bank
				try {
					const corpResponse = await client.getCorporateCustomersAtBank(firstAccount.bank_id);
					for (const cust of corpResponse.customers || []) {
						existing.customers.push({
							customer_id: cust.customer_id,
							legal_name: cust.legal_name,
							customer_type: 'CORPORATE',
							bank_id: firstAccount.bank_id
						});
					}
				} catch (e) {
					logger.warn(`Could not fetch corporate customers`);
				}

				// Get transactions for first account
				try {
					const transactions = await client.getTransactionsForAccount(firstAccount.bank_id, firstAccount.account_id);
					for (const txn of transactions.slice(0, 20)) { // Limit to 20
						existing.transactions.push({
							transaction_id: txn.transaction_id,
							bank_id: firstAccount.bank_id,
							from_account_id: firstAccount.account_id,
							to_account_id: txn.other_account?.id || '',
							amount: `${txn.details?.value?.amount || '0'} ${txn.details?.value?.currency || ''}`
						});
					}
				} catch (e) {
					logger.warn(`Could not fetch transactions`);
				}
			}
		} catch (e) {
			logger.error('Failed to load existing data:', e);
		}
	}

	return {
		username,
		obpBaseUrl: env.PUBLIC_OBP_BASE_URL,
		countries: COUNTRY_LIST.map(c => ({ code: c.code, name: c.name, currency: c.currency })),
		caseExamples: COUNTRY_LIST.map(c => ({ code: c.code, bankIds: getCaseExample(c.code).bankIds })),
		defaults: {
			numBanks: 2,
			numAccountsPerBank: 5,
			numUsers: 3,
			countryCode,
			currency,
			bankIdPrefix
		},
		existing
	};
};

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeVowels(str: string): string {
	return str.replace(/[aeiou]/gi, '');
}

function getUsernamePrefix(username: string): string {
	// Lowercase, remove special characters, keep only alphanumeric, remove vowels
	const cleaned = username.toLowerCase().replace(/[^a-z0-9]/g, '');
	return removeVowels(cleaned).slice(0, 4);
}

/** What the populate action created or found, by kind. */
export interface PopulateResults {
	banks: Array<{ bank_id: string; bank_code: string; full_name: string; existed: boolean }>;
	accounts: Array<{ account_id: string; bank_id: string; label: string; currency: string; existed: boolean }>;
	counterparties: Array<{ counterparty_id: string; name: string; bank_id: string; account_id: string; existed: boolean }>;
	customers: Array<{ customer_id: string; legal_name: string; customer_type: string; bank_id: string; existed: boolean }>;
	fxRates: Array<{ bank_id: string; from_currency: string; to_currency: string; rate: number; existed: boolean }>;
	transactions: Array<{ transaction_id: string; bank_id: string; from_account_id: string; to_account_id: string; amount: string; existed: boolean }>;
	users: Array<{ user_id: string; username: string; email: string; existed: boolean }>;
	userCustomerLinks: Array<{ username: string; legal_name: string; bank_id: string; existed: boolean }>;
	customerLinks: Array<{ customer_name: string; other_customer_name: string; relationship_to: string; bank_id: string; existed: boolean }>;
	errors: string[];
}

/**
 * The transaction requests the two transaction request actions created: to a counterparty, or to
 * another account. Each request names whichever it was sent to.
 */
export interface TransactionRequestResults {
	transactionRequests: Array<{
		id: string;
		type: string;
		status: string;
		amount: string;
		counterparty?: string;
		toAccount?: string;
	}>;
	errors: string[];
}

/** What the investigation case action created or found, by kind. */
export interface InvestigationCaseResults {
	banks: Array<{ bank_id: string; bank_code: string; full_name: string; existed: boolean }>;
	accounts: Array<{ account_id: string; bank_id: string; label: string; currency: string; existed: boolean }>;
	customers: Array<{ customer_id: string; legal_name: string; customer_type: string; bank_id: string; existed: boolean }>;
	customerAccountLinks: Array<{ legal_name: string; account_label: string; existed: boolean }>;
	customerLinks: Array<{ customer_name: string; other_customer_name: string; relationship_to: string; bank_id: string; existed: boolean }>;
	transactions: Array<{ transaction_id: string; bank_id: string; from_account_id: string; to_account_id: string; amount: string; existed: boolean; description: string }>;
	errors: string[];
}

export const actions: Actions = {
	populate: async ({ request, locals }) => {
		const session = locals.session;
		const accessToken = session?.data?.oauth?.access_token;
		const user = session?.data?.user;

		if (!accessToken || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const numBanks = parseInt(formData.get('numBanks') as string) || 2;
		const numAccountsPerBank = parseInt(formData.get('numAccountsPerBank') as string) || 5;
		const currency = (formData.get('currency') as string) || 'BWP';
		const countryCode = (formData.get('country') as string) || 'BW';
		const bankIdPrefix = (formData.get('bankIdPrefix') as string) || getUsernamePrefix(user.username);

		const client = new OBPClient(
			env.PUBLIC_OBP_BASE_URL,
			accessToken
		);

		// Fetch current user fresh from OBP (populate action) to get the authoritative user_id matching
		// the current access token (session data may be stale after token refresh or OBP DB reset)
		let currentUser: typeof user;
		try {
			currentUser = await client.getCurrentUser();
		} catch (e: any) {
			logger.error('Failed to fetch current user from OBP:', e.message);
			return fail(401, { error: `Your OBP user account could not be found. Please log out and log in again. (${e.message})` });
		}
		// Use the freshly fetched user_id for all subsequent operations
		const effectiveUser = { ...user, user_id: currentUser.user_id };

		// Save settings to session and OBP Personal Data Fields
		try {
			await session.setData({
				...session.data,
				sandbox_populator_last_bank_id_prefix: bankIdPrefix
			});
			await session.save();
		} catch (e) {
			logger.warn('Could not save settings to session');
		}
		try {
			const fields = await client.getPersonalDataFields();
			const attrs = fields.user_attributes || [];

			const settingsToSave = [
				{ name: 'sandbox_populator_last_bank_id_prefix', value: bankIdPrefix },
				{ name: 'sandbox_populator_last_country', value: countryCode },
				{ name: 'sandbox_populator_last_currency', value: currency },
			];

			for (const setting of settingsToSave) {
				const existing = attrs.find((f) => f.name === setting.name);
				if (existing) {
					await client.updatePersonalDataField(existing.user_attribute_id, {
						name: setting.name,
						type: 'STRING',
						value: setting.value
					});
				} else {
					await client.createPersonalDataField({
						name: setting.name,
						type: 'STRING',
						value: setting.value
					});
				}
			}
			logger.info(`Saved populate settings to personal data fields`);
		} catch (e) {
			logger.warn('Could not save settings to OBP personal data fields');
		}

		const createCounterparties = formData.get('createCounterparties') === 'on';
		const createCustomers = formData.get('createCustomers') === 'on';
		const createFxRates = formData.get('createFxRates') === 'on';
		const createTransactions = formData.get('createTransactions') === 'on';
		const createUsers = formData.get('createUsers') === 'on';
		const numUsers = parseInt(formData.get('numUsers') as string) || 3;
		const createUserCustomerLinks = formData.get('createUserCustomerLinks') === 'on';
		const createCustomerLinks = formData.get('createCustomerLinks') === 'on';

		const results: PopulateResults = {
			banks: [],
			accounts: [],
			counterparties: [],
			customers: [],
			fxRates: [],
			transactions: [],
			users: [],
			userCustomerLinks: [],
			customerLinks: [],
			errors: []
		};

		try {
			// Create Banks
			logger.info(`Creating ${numBanks} banks...`);
			for (let i = 1; i <= numBanks; i++) {
				const bankId = `${bankIdPrefix}-bnk-${i}`;
				const bankName = `${effectiveUser.username} Test Bank ${i}`;

				const bank_code = `${bankIdPrefix}${i}${countryCode}`;
				try {
					const exists = await client.bankExists(bankId);
					if (exists) {
						logger.info(`Bank ${bankId} already exists, skipping`);
						results.banks.push({ bank_id: bankId, bank_code, full_name: bankName, existed: true });
					} else {
						const bank = await client.createBank({
							bank_id: bankId,
							full_name: bankName,
							bank_code: bank_code
						});
						logger.debug('Bank creation response:', JSON.stringify(bank));
						results.banks.push({ bank_id: bank.bank_id, bank_code: bank.bank_code, full_name: bank.full_name, existed: false });
						logger.info(`Created bank: ${bank.bank_id}`);
					}
					// Always ensure entitlements (needed even on re-run)
					for (const role of ['CanCreateAccount', 'CanCreateHistoricalTransactionAtBank', 'CanCreateCustomer', 'CanGetCustomersAtOneBank', 'CanCreateUserCustomerLink', 'CanGetUserCustomerLink', 'CanCreateCustomerLink']) {
						try {
							await client.createEntitlement(effectiveUser.user_id, bankId, role);
							logger.info(`Granted ${role} at ${bankId}`);
						} catch (entErr: any) {
							logger.warn(`Could not grant ${role} at ${bankId}: ${entErr.message}`);
						}
					}
				} catch (e: any) {
					const errorMsg = `Failed to create bank ${bankId}: ${e.message}`;
					logger.error(errorMsg);
					results.errors.push(errorMsg);
				}

				await delay(100); // Rate limiting delay
			}

			// Create Accounts for each bank
			logger.info(`Creating ${numAccountsPerBank} accounts per bank...`);
			for (const bank of results.banks) {
				// Get existing accounts for this bank (v6.0.0 returns account_id)
				let existingAccounts: Array<{ account_id: string; label?: string; currency?: string }> = [];
				try {
					const accountsResponse = await client.getAccountsAtBank(bank.bank_id);
					existingAccounts = accountsResponse.accounts || [];
					logger.debug(`Found ${existingAccounts.length} existing accounts at ${bank.bank_id}`);
				} catch (e: any) {
					logger.warn(`Could not fetch existing accounts for ${bank.bank_id}: ${e.message}`);
				}

				for (let j = 1; j <= numAccountsPerBank; j++) {
					const label = `Account ${j}`;
					try {
						// Check if account with this label already exists
						const existingAccount = existingAccounts.find(a => a.label === label);
						if (existingAccount) {
							logger.info(`Account "${label}" already exists at ${bank.bank_id}, skipping`);
							results.accounts.push({
								account_id: existingAccount.account_id,
								bank_id: bank.bank_id,
								label: existingAccount.label || label,
								currency: existingAccount.currency || currency,
								existed: true
							});
						} else {
							const account = await client.createAccount(bank.bank_id, {
								label: label,
								currency: currency,
								balance: { amount: '0', currency: currency },
								user_id: effectiveUser.user_id
							});
							logger.debug('Account creation response:', JSON.stringify(account));
							results.accounts.push({
								account_id: account.account_id,
								bank_id: bank.bank_id,
								label: account.label,
								currency: account.currency,
								existed: false
							});
							logger.info(`Created account: ${account.account_id} at ${bank.bank_id}`);
						}
					} catch (e: any) {
						const errorMsg = `Failed to create account at ${bank.bank_id}: ${e.message}`;
						logger.error(errorMsg);
						results.errors.push(errorMsg);
					}
					await delay(100);
				}
			}

			// Create Counterparties
			if (createCounterparties && results.accounts.length > 0) {
				logger.info('Creating counterparties...');
				const businesses = getBusinesses(countryCode, 10);
				const firstAccount = results.accounts[0];

				// Get existing counterparties for this account
				let existingCounterparties: Array<{ counterparty_id?: string; name?: string }> = [];
				try {
					const cpResponse = await client.getCounterparties(firstAccount.bank_id, firstAccount.account_id);
					existingCounterparties = cpResponse.counterparties || [];
					logger.debug(`Found ${existingCounterparties.length} existing counterparties`);
				} catch (e: any) {
					logger.warn(`Could not fetch existing counterparties: ${e.message}`);
				}

				for (const business of businesses) {
					try {
						// Check if counterparty with this name already exists
						const existingCp = existingCounterparties.find(cp => cp.name === business.name);
						if (existingCp && existingCp.counterparty_id) {
							logger.info(`Counterparty "${business.name}" already exists, skipping`);
							results.counterparties.push({
								counterparty_id: existingCp.counterparty_id,
								name: business.name,
								bank_id: firstAccount.bank_id,
								account_id: firstAccount.account_id,
								existed: true
							});
						} else {
							const payload = getBusinessForCounterparty(business, currency);
							const counterparty = await client.createCounterparty(firstAccount.bank_id, firstAccount.account_id, payload);
							results.counterparties.push({
								counterparty_id: counterparty.counterparty_id,
								name: business.name,
								bank_id: firstAccount.bank_id,
								account_id: firstAccount.account_id,
								existed: false
							});
							logger.info(`Created counterparty: ${business.name}`);
						}
					} catch (e: any) {
						const errorMsg = `Failed to create counterparty ${business.name}: ${e.message}`;
						logger.error(errorMsg);
						results.errors.push(errorMsg);
					}
					await delay(100);
				}
			}

			// Create Customers (Individual and Corporate)
			if (createCustomers && results.banks.length > 0) {
				logger.info('Creating customers...');
				const firstBank = results.banks[0];

				// Get existing customers at this bank to check for duplicates
				let existingCustomers: Array<{ customer_id: string; legal_name: string; customer_type?: string }> = [];
				try {
					const custResponse = await client.getCustomersAtBank(firstBank.bank_id);
					existingCustomers = custResponse.customers || [];
					logger.debug(`Found ${existingCustomers.length} existing customers at ${firstBank.bank_id}`);
				} catch (e: any) {
					logger.warn(`Could not fetch existing customers: ${e.message}`);
				}

				// Get existing user-customer links
				let existingLinks: Array<{ customer_id: string }> = [];
				try {
					const linksResponse = await client.getUserCustomerLinksByUserId(firstBank.bank_id, effectiveUser.user_id);
					existingLinks = linksResponse.user_customer_links || [];
				} catch (e: any) {
					logger.warn(`Could not fetch user-customer links: ${e.message}`);
				}

				// --- Create "My" individual customer for the logged-in user ---
				const myIndividualName = `${effectiveUser.username} (Individual)`;
				try {
					const existingMy = existingCustomers.find(c => c.legal_name === myIndividualName);
					if (existingMy) {
						logger.info(`My individual customer already exists, skipping`);
						results.customers.push({
							customer_id: existingMy.customer_id,
							legal_name: myIndividualName,
							customer_type: 'INDIVIDUAL',
							bank_id: firstBank.bank_id,
							existed: true
						});
					} else {
						const myCustomer = await client.createCustomer(firstBank.bank_id, {
							legal_name: myIndividualName,
							mobile_phone_number: '+267 70 000 0001',
							email: effectiveUser.email || `${effectiveUser.username}@example.bw`,
							kyc_status: true,
							credit_limit: { currency, amount: '50000' },
							credit_rating: { rating: 'A', source: 'OBP' },
							last_ok_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
						});
						results.customers.push({
							customer_id: myCustomer.customer_id,
							legal_name: myCustomer.legal_name,
							customer_type: 'INDIVIDUAL',
							bank_id: firstBank.bank_id,
							existed: false
						});
						logger.info(`Created my individual customer: ${myCustomer.legal_name}`);

						// Create user-customer link
						const alreadyLinked = existingLinks.some(l => l.customer_id === myCustomer.customer_id);
						if (!alreadyLinked) {
							try {
								await client.createUserCustomerLink(firstBank.bank_id, {
									user_id: effectiveUser.user_id,
									customer_id: myCustomer.customer_id
								});
								logger.info(`Linked user to individual customer ${myCustomer.customer_id}`);
							} catch (linkErr: any) {
								logger.warn(`Could not link user to individual customer: ${linkErr.message}`);
								results.errors.push(`User-customer link (individual): ${linkErr.message}`);
							}
						}
					}
				} catch (e: any) {
					const errorMsg = `Failed to create my individual customer: ${e.message}`;
					logger.error(errorMsg);
					results.errors.push(errorMsg);
				}
				await delay(100);

				// --- Create "My" corporate customer for the logged-in user ---
				const myCorporateName = `${effectiveUser.username} Corp (Pty) Ltd`;
				try {
					const existingMyCorp = existingCustomers.find(c => c.legal_name === myCorporateName);
					if (existingMyCorp) {
						logger.info(`My corporate customer already exists, skipping`);
						results.customers.push({
							customer_id: existingMyCorp.customer_id,
							legal_name: myCorporateName,
							customer_type: 'CORPORATE',
							bank_id: firstBank.bank_id,
							existed: true
						});
					} else {
						const myCorpCustomer = await client.createCorporateCustomer(firstBank.bank_id, {
							legal_name: myCorporateName,
							mobile_phone_number: '+267 31 000 0001',
							email: `corp-${effectiveUser.username}@example.bw`,
							kyc_status: true,
							credit_limit: { currency, amount: '1000000' },
							credit_rating: { rating: 'AAA', source: 'OBP' },
							last_ok_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
						});
						results.customers.push({
							customer_id: myCorpCustomer.customer_id,
							legal_name: myCorpCustomer.legal_name,
							customer_type: 'CORPORATE',
							bank_id: firstBank.bank_id,
							existed: false
						});
						logger.info(`Created my corporate customer: ${myCorpCustomer.legal_name}`);

						// Create user-customer link
						const alreadyLinked = existingLinks.some(l => l.customer_id === myCorpCustomer.customer_id);
						if (!alreadyLinked) {
							try {
								await client.createUserCustomerLink(firstBank.bank_id, {
									user_id: effectiveUser.user_id,
									customer_id: myCorpCustomer.customer_id
								});
								logger.info(`Linked user to corporate customer ${myCorpCustomer.customer_id}`);
							} catch (linkErr: any) {
								logger.warn(`Could not link user to corporate customer: ${linkErr.message}`);
								results.errors.push(`User-customer link (corporate): ${linkErr.message}`);
							}
						}
					}
				} catch (e: any) {
					const errorMsg = `Failed to create my corporate customer: ${e.message}`;
					logger.error(errorMsg);
					results.errors.push(errorMsg);
				}
				await delay(100);

				// --- Create general sample individual customers ---
				const individualCustomers = getIndividualCustomers(countryCode, 5);
				for (const custData of individualCustomers) {
					try {
						const existingCust = existingCustomers.find(c => c.legal_name === custData.legal_name);
						if (existingCust) {
							logger.info(`Customer "${custData.legal_name}" already exists, skipping`);
							results.customers.push({
								customer_id: existingCust.customer_id,
								legal_name: custData.legal_name,
								customer_type: existingCust.customer_type || 'INDIVIDUAL',
								bank_id: firstBank.bank_id,
								existed: true
							});
						} else {
							const payload = toCreateCustomerPayload(custData, currency);
							const customer = await client.createCustomer(firstBank.bank_id, payload);
							results.customers.push({
								customer_id: customer.customer_id,
								legal_name: customer.legal_name,
								customer_type: 'INDIVIDUAL',
								bank_id: firstBank.bank_id,
								existed: false
							});
							logger.info(`Created individual customer: ${customer.legal_name}`);
						}
					} catch (e: any) {
						const errorMsg = `Failed to create customer ${custData.legal_name}: ${e.message}`;
						logger.error(errorMsg);
						results.errors.push(errorMsg);
					}
					await delay(100);
				}

				// --- Create general sample corporate customers ---
				const corporateCustomers = getCorporateCustomers(countryCode, 5);
				for (const corpData of corporateCustomers) {
					try {
						const existingCust = existingCustomers.find(c => c.legal_name === corpData.legal_name);
						if (existingCust) {
							logger.info(`Corporate customer "${corpData.legal_name}" already exists, skipping`);
							results.customers.push({
								customer_id: existingCust.customer_id,
								legal_name: corpData.legal_name,
								customer_type: existingCust.customer_type || 'CORPORATE',
								bank_id: firstBank.bank_id,
								existed: true
							});
						} else {
							const payload = toCreateCorporateCustomerPayload(corpData, currency);
							const customer = await client.createCorporateCustomer(firstBank.bank_id, payload);
							results.customers.push({
								customer_id: customer.customer_id,
								legal_name: customer.legal_name,
								customer_type: 'CORPORATE',
								bank_id: firstBank.bank_id,
								existed: false
							});
							logger.info(`Created corporate customer: ${customer.legal_name}`);
						}
					} catch (e: any) {
						const errorMsg = `Failed to create corporate customer ${corpData.legal_name}: ${e.message}`;
						logger.error(errorMsg);
						results.errors.push(errorMsg);
					}
					await delay(100);
				}

				logger.info(`Created ${results.customers.length} customers`);
			}

			// Create Customer Links (customer-to-customer relationships)
			if (createCustomerLinks && results.customers.length >= 2 && results.banks.length > 0) {
				logger.info('Creating customer links...');
				const firstBank = results.banks[0];
				const individualCustomers = results.customers.filter(c => c.customer_type === 'INDIVIDUAL');

				// Define relationship pairs: link pairs of individual customers with various relationship types
				const relationshipTypes = ['spouse', 'parent', 'close_associate', 'sibling', 'business_partner'];

				for (let i = 0; i < individualCustomers.length - 1; i++) {
					const cust1 = individualCustomers[i];
					const cust2 = individualCustomers[i + 1];
					const relationship = relationshipTypes[i % relationshipTypes.length];

					try {
						await client.createCustomerLink(firstBank.bank_id, {
							customer_id: cust1.customer_id,
							other_bank_id: firstBank.bank_id,
							other_customer_id: cust2.customer_id,
							relationship_to: relationship
						});
						results.customerLinks.push({
							customer_name: cust1.legal_name,
							other_customer_name: cust2.legal_name,
							relationship_to: relationship,
							bank_id: firstBank.bank_id,
							existed: false
						});
						logger.info(`Created customer link: ${cust1.legal_name} → ${cust2.legal_name} (${relationship})`);
					} catch (e: any) {
						const errorMsg = `Customer link ${cust1.legal_name} → ${cust2.legal_name}: ${e.message}`;
						logger.error(errorMsg);
						results.errors.push(errorMsg);
					}
					await delay(100);
				}
				logger.info(`Created ${results.customerLinks.filter(l => !l.existed).length} customer links`);
			}

			// Create FX Rates
			if (createFxRates && results.banks.length > 0) {
				logger.info('Creating FX rates...');
				for (const bank of results.banks) {
					for (const [targetCurrency, rate] of Object.entries(FX_RATES)) {
						try {
							const effectiveDate = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

							// Check if forward rate exists
							const existingForwardRate = await client.getFxRate(bank.bank_id, currency, targetCurrency);
							if (existingForwardRate) {
								logger.info(`FX rate ${currency}→${targetCurrency} already exists at ${bank.bank_id}, skipping`);
								results.fxRates.push({
									bank_id: bank.bank_id,
									from_currency: currency,
									to_currency: targetCurrency,
									rate: existingForwardRate.conversion_value,
									existed: true
								});
							} else {
								await client.createFxRate(bank.bank_id, {
									from_currency_code: currency,
									to_currency_code: targetCurrency,
									conversion_value: rate,
									effective_date: effectiveDate
								});
								results.fxRates.push({
									bank_id: bank.bank_id,
									from_currency: currency,
									to_currency: targetCurrency,
									rate: rate,
									existed: false
								});
							}

							// Check if reverse rate exists
							const existingReverseRate = await client.getFxRate(bank.bank_id, targetCurrency, currency);
							if (existingReverseRate) {
								logger.info(`FX rate ${targetCurrency}→${currency} already exists at ${bank.bank_id}, skipping`);
								results.fxRates.push({
									bank_id: bank.bank_id,
									from_currency: targetCurrency,
									to_currency: currency,
									rate: existingReverseRate.conversion_value,
									existed: true
								});
							} else {
								await client.createFxRate(bank.bank_id, {
									from_currency_code: targetCurrency,
									to_currency_code: currency,
									conversion_value: 1 / rate,
									effective_date: effectiveDate
								});
								results.fxRates.push({
									bank_id: bank.bank_id,
									from_currency: targetCurrency,
									to_currency: currency,
									rate: parseFloat((1 / rate).toFixed(6)),
									existed: false
								});
							}
						} catch (e: any) {
							const errorMsg = `FX rate ${currency}→${targetCurrency} at ${bank.bank_id}: ${e.message}`;
							logger.error(errorMsg);
							results.errors.push(errorMsg);
						}
						await delay(50);
					}
				}
				logger.info(`Created ${results.fxRates.length} FX rates`);
			}

			// Create Historical Transactions
			if (createTransactions && results.accounts.length >= 2) {
				logger.info('Creating historical transactions...');
				const bankAccounts: Record<string, string[]> = {};

				// Group accounts by bank
				for (const account of results.accounts) {
					if (!bankAccounts[account.bank_id]) {
						bankAccounts[account.bank_id] = [];
					}
					bankAccounts[account.bank_id].push(account.account_id);
				}

				// Create transactions within each bank
				const now = new Date();
				for (const [bank_id, account_ids] of Object.entries(bankAccounts)) {
					if (account_ids.length < 2) continue;

					// Get existing transactions for the first account to check for duplicates
					let existingTransactions: Array<{ transaction_id: string; details?: { description?: string; value?: { amount?: string; currency?: string } } }> = [];
					try {
						existingTransactions = await client.getTransactionsForAccount(bank_id, account_ids[0]);
						logger.debug(`Found ${existingTransactions.length} existing transactions for account ${account_ids[0]}`);
					} catch (e: any) {
						logger.warn(`Could not fetch existing transactions: ${e.message}`);
					}

					// Create some transactions over the last 12 months
					for (let month = 0; month < 12; month++) {
						const date = new Date(now);
						date.setMonth(date.getMonth() - month);
						const dateStr = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
						const description = `Monthly transfer ${month + 1}`;

						// Check if a transaction with this description already exists
						const existingTxn = existingTransactions.find(t => t.details?.description === description);
						if (existingTxn) {
							logger.info(`Transaction "${description}" already exists at ${bank_id}, skipping`);
							const amount = existingTxn.details?.value?.amount || '0';
							const txnCurrency = existingTxn.details?.value?.currency || currency;
							results.transactions.push({
								transaction_id: existingTxn.transaction_id,
								bank_id: bank_id,
								from_account_id: account_ids[0],
								to_account_id: account_ids[1] || account_ids[0],
								amount: `${amount} ${txnCurrency}`,
								existed: true
							});
							continue;
						}

						// Random transaction between accounts
						const fromIdx = Math.floor(Math.random() * account_ids.length);
						let toIdx = Math.floor(Math.random() * account_ids.length);
						while (toIdx === fromIdx) {
							toIdx = Math.floor(Math.random() * account_ids.length);
						}

						try {
							const amount = (Math.random() * 1000 + 100).toFixed(2);
							const txn = await client.createHistoricalTransaction(bank_id, {
								from_account_id: account_ids[fromIdx],
								to_account_id: account_ids[toIdx],
								value: {
									currency: currency,
									amount: amount
								},
								description: description,
								posted: dateStr,
								completed: dateStr
							});
							logger.debug('Transaction creation response:', JSON.stringify(txn));
							results.transactions.push({
								transaction_id: txn.transaction_id,
								bank_id: bank_id,
								from_account_id: account_ids[fromIdx],
								to_account_id: account_ids[toIdx],
								amount: `${amount} ${currency}`,
								existed: false
							});
						} catch (e: any) {
							const errorMsg = `Transaction at ${bank_id}: ${e.message}`;
							logger.error(errorMsg);
							results.errors.push(errorMsg);
						}
						await delay(100);
					}
				}
				logger.info(`Created ${results.transactions.length} historical transactions`);
			}

			// Create Users
			if (createUsers) {
				logger.info(`Creating ${numUsers} users...`);
				const TEST_PASSWORD = 'Test12345!';
				const individualData = getIndividualCustomers(countryCode, numUsers);

				for (let i = 1; i <= numUsers; i++) {
					const custData = individualData[i - 1];
					const nameParts = custData ? custData.legal_name.split(' ') : [];
					const firstName = nameParts[0] || `User${i}`;
					const lastName = nameParts[nameParts.length - 1] || 'Test';
					const username = `${bankIdPrefix}user${i}`;
					const email = `${bankIdPrefix}user${i}@example.com`;

					try {
						const newUser = await client.createUser({
							email,
							username,
							password: TEST_PASSWORD,
							first_name: firstName,
							last_name: lastName
						});
						results.users.push({
							user_id: newUser.user_id,
							username: newUser.username,
							email: newUser.email,
							existed: false
						});
						logger.info(`Created user: ${username}`);
					} catch (e: any) {
						const errorMsg = `Failed to create user ${username}: ${e.message}`;
						logger.error(errorMsg);
						results.errors.push(errorMsg);
					}
					await delay(100);
				}
				logger.info(`Created ${results.users.filter(u => !u.existed).length} users`);
			}

			// Create User-Customer Links
			if (createUserCustomerLinks && results.users.length > 0 && results.customers.length > 0 && results.banks.length > 0) {
				logger.info('Creating user-customer links...');
				const firstBank = results.banks[0];
				const individualCustomers = results.customers.filter(c => c.customer_type === 'INDIVIDUAL');

				for (let i = 0; i < results.users.length; i++) {
					const obpUser = results.users[i];
					if (!obpUser.user_id) {
						logger.info(`Skipping user-customer link for ${obpUser.username}: no user_id (already existed)`);
						continue;
					}
					const customer = individualCustomers[i % individualCustomers.length];
					if (!customer) continue;

					try {
						const existingLinks = await client.getUserCustomerLinksByUserId(firstBank.bank_id, obpUser.user_id);
						const alreadyLinked = existingLinks.user_customer_links?.some(l => l.customer_id === customer.customer_id);
						if (alreadyLinked) {
							results.userCustomerLinks.push({ username: obpUser.username, legal_name: customer.legal_name, bank_id: firstBank.bank_id, existed: true });
							logger.info(`Link ${obpUser.username} → ${customer.legal_name} already exists, skipping`);
						} else {
							await client.createUserCustomerLink(firstBank.bank_id, {
								user_id: obpUser.user_id,
								customer_id: customer.customer_id
							});
							results.userCustomerLinks.push({ username: obpUser.username, legal_name: customer.legal_name, bank_id: firstBank.bank_id, existed: false });
							logger.info(`Linked user ${obpUser.username} → customer ${customer.legal_name}`);
						}
					} catch (e: any) {
						const errorMsg = `User-customer link ${obpUser.username} → ${customer.legal_name}: ${e.message}`;
						logger.error(errorMsg);
						results.errors.push(errorMsg);
					}
					await delay(100);
				}
				logger.info(`Created ${results.userCustomerLinks.filter(l => !l.existed).length} user-customer links`);
			}

			return {
				success: true,
				results
			};
		} catch (e: any) {
			logger.error('Population failed:', e);
			return fail(500, {
				error: e.message || 'Population failed',
				results
			});
		}
	},

	preview: async ({ request, locals }) => {
		const user = locals.session?.data?.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const numBanks = parseInt(formData.get('numBanks') as string) || 2;
		const numAccountsPerBank = parseInt(formData.get('numAccountsPerBank') as string) || 5;
		const currency = (formData.get('currency') as string) || 'BWP';
		const countryCode = (formData.get('country') as string) || 'BW';
		const bankIdPrefix = (formData.get('bankIdPrefix') as string) || getUsernamePrefix(user.username);
		const withCounterparties = formData.get('createCounterparties') === 'on';
		const withCustomers = formData.get('createCustomers') === 'on';
		const withFxRates = formData.get('createFxRates') === 'on';
		const withTransactions = formData.get('createTransactions') === 'on';
		const withUsers = formData.get('createUsers') === 'on';
		const numUsers = parseInt(formData.get('numUsers') as string) || 3;
		const withUserCustomerLinks = formData.get('createUserCustomerLinks') === 'on';
		const withCustomerLinks = formData.get('createCustomerLinks') === 'on';

		// Banks
		const banks = Array.from({ length: numBanks }, (_, i) => ({
			bank_id: `${bankIdPrefix}-bnk-${i + 1}`,
			full_name: `${user.username} Test Bank ${i + 1}`,
			bank_code: `${bankIdPrefix}${i + 1}${countryCode}`
		}));

		// Accounts
		const accounts = banks.flatMap(bank =>
			Array.from({ length: numAccountsPerBank }, (_, j) => ({
				bank_id: bank.bank_id,
				label: `Account ${j + 1}`,
				currency
			}))
		);

		// Counterparties
		const counterparties = withCounterparties
			? getBusinesses(countryCode, 10).map(b => ({ name: b.name, industry: b.category }))
			: [];

		// Customers
		const customers = withCustomers ? [
			{ legal_name: `${user.username} (Individual)`, type: 'INDIVIDUAL', note: 'your individual customer' },
			{ legal_name: `${user.username} Corp (Pty) Ltd`, type: 'CORPORATE', note: 'your corporate customer' },
			...getIndividualCustomers(countryCode, 5).map(c => ({ legal_name: c.legal_name, type: 'INDIVIDUAL', note: 'sample' })),
			...getCorporateCustomers(countryCode, 5).map(c => ({ legal_name: c.legal_name, type: 'CORPORATE', note: 'sample' }))
		] : [];

		// FX rates
		const fxRatePairs = withFxRates
			? banks.flatMap(bank =>
				Object.entries(FX_RATES).flatMap(([target, rate]) => [
					{ bank_id: bank.bank_id, from: currency, to: target, rate },
					{ bank_id: bank.bank_id, from: target, to: currency, rate: parseFloat((1 / rate).toFixed(6)) }
				])
			)
			: [];

		// Transactions — amounts are random at runtime, describe count only
		const transactionCount = withTransactions
			? banks.filter(b => accounts.filter(a => a.bank_id === b.bank_id).length >= 2).length * 12
			: 0;

		// Users
		const users = withUsers
			? Array.from({ length: numUsers }, (_, i) => ({
				username: `${bankIdPrefix}user${i + 1}`,
				email: `${bankIdPrefix}user${i + 1}@example.com`
			}))
			: [];

		// User-Customer Links preview
		const individualCustomersPreview = withCustomers
			? [
				{ legal_name: `${user.username} (Individual)`, type: 'INDIVIDUAL' },
				...getIndividualCustomers(countryCode, 5).map(c => ({ legal_name: c.legal_name, type: 'INDIVIDUAL' }))
			]
			: [];
		const userCustomerLinks = withUserCustomerLinks && withUsers && individualCustomersPreview.length > 0
			? users.map((u, i) => ({
				username: u.username,
				legal_name: individualCustomersPreview[i % individualCustomersPreview.length]?.legal_name ?? ''
			}))
			: [];

		// Customer Links preview
		const relationshipTypes = ['spouse', 'parent', 'close_associate', 'sibling', 'business_partner'];
		const customerLinks = withCustomerLinks && withCustomers && individualCustomersPreview.length >= 2
			? individualCustomersPreview.slice(0, -1).map((c, i) => ({
				customer_name: c.legal_name,
				other_customer_name: individualCustomersPreview[i + 1]?.legal_name ?? '',
				relationship_to: relationshipTypes[i % relationshipTypes.length]
			}))
			: [];

		const totalEntities =
			banks.length +
			accounts.length +
			counterparties.length +
			customers.length +
			fxRatePairs.length +
			transactionCount +
			users.length +
			userCustomerLinks.length +
			customerLinks.length;

		return {
			preview: {
				banks,
				accounts,
				counterparties,
				customers,
				fxRatePairs,
				transactions: withTransactions
					? { count: transactionCount, note: '12 monthly historical transactions per bank, amounts are random at populate time' }
					: null,
				users,
				userCustomerLinks,
				customerLinks,
				summary: {
					banks: banks.length,
					accounts: accounts.length,
					counterparties: counterparties.length,
					customers: customers.length,
					fxRatePairs: fxRatePairs.length,
					transactions: transactionCount,
					users: users.length,
					userCustomerLinks: userCustomerLinks.length,
					customerLinks: customerLinks.length,
					total: totalEntities
				}
			}
		};
	},

	createCounterpartyTransactionRequests: async ({ locals }) => {
		const session = locals.session;
		const accessToken = session?.data?.oauth?.access_token;
		const user = session?.data?.user;

		if (!accessToken || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const client = new OBPClient(env.PUBLIC_OBP_BASE_URL, accessToken);
		const bankIdPrefix = getUsernamePrefix(user.username);

		const results: TransactionRequestResults = {
			transactionRequests: [],
			errors: []
		};

		try {
			// Find user's banks
			const banksResponse = await client.getBanks();
			const userBanks = banksResponse.banks.filter(b => b.bank_id.startsWith(bankIdPrefix + '-'));

			if (userBanks.length === 0) {
				return fail(400, { error: 'No banks found. Please populate first.', results });
			}

			const bank = userBanks[0];

			// Get accounts for this bank (v6.0.0 returns account_id)
			const accountsResponse = await client.getAccountsAtBank(bank.bank_id);
			const accounts = accountsResponse.accounts || [];

			if (accounts.length === 0) {
				return fail(400, { error: `No accounts found for bank ${bank.bank_id}. Please populate first.`, results });
			}

			const account = accounts[0];

			// Get counterparties for this account
			const cpResponse = await client.getCounterparties(bank.bank_id, account.account_id);
			const counterparties = cpResponse.counterparties || [];

			if (counterparties.length === 0) {
				return fail(400, { error: 'No counterparties found. Please populate with counterparties first.', results });
			}

			// Create 10 transaction requests to various counterparties
			const descriptions = [
				'Office supplies', 'Consulting services', 'Monthly subscription',
				'Equipment rental', 'Catering services', 'Marketing materials',
				'Training workshop', 'Software license', 'Maintenance fee', 'Delivery charges'
			];

			for (let i = 0; i < 10; i++) {
				const counterparty = counterparties[i % counterparties.length];
				const amount = (Math.random() * 50 + 5).toFixed(2); // Low value: 5-55
				const description = descriptions[i];

				try {
					const txnRequest = await client.createTransactionRequestCounterparty(
						bank.bank_id,
						account.account_id,
						{
							to: { counterparty_id: counterparty.counterparty_id },
							value: { currency: 'BWP', amount },
							description,
							charge_policy: 'SHARED'
						}
					);

					results.transactionRequests.push({
						id: txnRequest.id,
						type: 'COUNTERPARTY',
						status: txnRequest.status,
						amount: `${amount} BWP`,
						counterparty: counterparty.name
					});
					logger.info(`Created COUNTERPARTY transaction request: ${txnRequest.id}`);
				} catch (e: any) {
					const errorMsg = `Failed to create transaction request to ${counterparty.name}: ${e.message}`;
					logger.error(errorMsg);
					results.errors.push(errorMsg);
				}

				await delay(100);
			}

			return { success: true, action: 'counterpartyTransactionRequests', results };
		} catch (e: any) {
			logger.error('Failed to create counterparty transaction requests:', e);
			return fail(500, { error: e.message, results });
		}
	},

	createAccountTransactionRequests: async ({ locals }) => {
		const session = locals.session;
		const accessToken = session?.data?.oauth?.access_token;
		const user = session?.data?.user;

		if (!accessToken || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const client = new OBPClient(env.PUBLIC_OBP_BASE_URL, accessToken);
		const bankIdPrefix = getUsernamePrefix(user.username);

		const results: TransactionRequestResults = {
			transactionRequests: [],
			errors: []
		};

		try {
			// Find user's banks
			const banksResponse = await client.getBanks();
			const userBanks = banksResponse.banks.filter(b => b.bank_id.startsWith(bankIdPrefix + '-'));

			if (userBanks.length === 0) {
				return fail(400, { error: 'No banks found. Please populate first.', results });
			}

			const bank = userBanks[0];

			// Get accounts for this bank (v6.0.0 returns account_id)
			const accountsResponse = await client.getAccountsAtBank(bank.bank_id);
			const accounts = accountsResponse.accounts || [];

			if (accounts.length < 2) {
				return fail(400, { error: 'Need at least 2 accounts. Please populate first.', results });
			}

			const fromAccount = accounts[0];

			// Create 10 transaction requests to various accounts
			const descriptions = [
				'Internal transfer', 'Savings deposit', 'Budget allocation',
				'Expense reimbursement', 'Petty cash', 'Reserve fund',
				'Operating expenses', 'Payroll funding', 'Investment transfer', 'Emergency fund'
			];

			for (let i = 0; i < 10; i++) {
				const toAccount = accounts[(i % (accounts.length - 1)) + 1]; // Skip first account
				const amount = (Math.random() * 50 + 5).toFixed(2); // Low value: 5-55
				const description = descriptions[i];

				try {
					const txnRequest = await client.createTransactionRequest(
						bank.bank_id,
						fromAccount.account_id,
						{
							to: { bank_id: bank.bank_id, account_id: toAccount.account_id },
							value: { currency: 'BWP', amount },
							description
						}
					);

					results.transactionRequests.push({
						id: txnRequest.id,
						type: 'ACCOUNT',
						status: txnRequest.status,
						amount: `${amount} BWP`,
						toAccount: toAccount.label || toAccount.account_id
					});
					logger.info(`Created ACCOUNT transaction request: ${txnRequest.id}`);
				} catch (e: any) {
					const errorMsg = `Failed to create transaction request to ${toAccount.account_id}: ${e.message}`;
					logger.error(errorMsg);
					results.errors.push(errorMsg);
				}

				await delay(100);
			}

			return { success: true, action: 'accountTransactionRequests', results };
		} catch (e: any) {
			logger.error('Failed to create account transaction requests:', e);
			return fail(500, { error: e.message, results });
		}
	},

	populateInvestigationCase: async ({ request, locals }) => {
		const session = locals.session;
		const accessToken = session?.data?.oauth?.access_token;
		const user = session?.data?.user;

		if (!accessToken || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const casePrefix = (formData.get('casePrefix') as string) || getUsernamePrefix(user.username);
		const countryConfig = getCountryConfig((formData.get('country') as string) || 'BW');
		const CURRENCY = (formData.get('currency') as string) || countryConfig.currency;
		const cast = getCaseExample(countryConfig.code);
		const caseBankIdsRaw = (formData.get('caseBankIds') as string) || cast.bankIds.join(', ');
		const caseBankIds = caseBankIdsRaw.split(',').map(s => s.trim()).filter(Boolean);
		if (caseBankIds.length < 3) {
			return fail(400, { error: 'Please provide at least 3 bank IDs (comma-separated).' });
		}

		const client = new OBPClient(env.PUBLIC_OBP_BASE_URL, accessToken);

		// Fetch current user fresh from OBP
		let currentUser: typeof user;
		try {
			currentUser = await client.getCurrentUser();
		} catch (e: any) {
			logger.error('Failed to fetch current user from OBP:', e.message);
			return fail(401, { error: `Your OBP user account could not be found. Please log out and log in again. (${e.message})` });
		}
		const effectiveUser = { ...user, user_id: currentUser.user_id };

		const results: InvestigationCaseResults = {
			banks: [],
			accounts: [],
			customers: [],
			customerAccountLinks: [],
			customerLinks: [],
			transactions: [],
			errors: []
		};

		// ── Bank definitions (prefixed with user-provided IDs) ──
		const pfx = (id: string) => `${casePrefix}-${id}`;
		// Bank 1 = normal layer, Bank 2 = suspicious layer, Bank 3 = expansion layer
		const BANKS = caseBankIds.map((id, i) => ({
			bank_id: pfx(id),
			full_name: `Case Bank ${i + 1} (${id})`,
			bank_code: `${casePrefix}${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`
		}));

		// ── Customer definitions ──
		// bank1 = normal, bank2 = suspicious, bank3 = expansion
		const bank1 = BANKS[0].bank_id;
		const bank2 = BANKS[1].bank_id;
		const bank3 = BANKS[2].bank_id;

		// Amounts below are written in ZAR; scale them to the selected currency (3 significant figures)
		const fxScale = (FX_RATES[CURRENCY] ?? (CURRENCY === BASE_CURRENCY ? 1 : FX_RATES.ZAR)) / FX_RATES.ZAR;
		const amt = (zar: string) => Number((parseFloat(zar) * fxScale).toPrecision(3)).toFixed(2);

		const { suspect, spouse, colleague, vendor, employer, consultancy, holdings } = cast;

		// Individuals
		const INDIVIDUALS = [
			{ ...suspect, title: 'Mr', employment: 'employed', education: 'Bachelor', relationship: 'married', banks: [bank1, bank2] },
			{ ...spouse, title: 'Mrs', employment: 'employed', education: 'Diploma', relationship: 'married', banks: [bank1] },
			{ ...colleague, title: 'Ms', employment: 'employed', education: 'Bachelor', relationship: 'single', banks: [bank1] },
			{ ...vendor, title: 'Mr', employment: 'self-employed', education: '', relationship: 'single', banks: [bank2] }
		];
		// Corporates
		const CORPORATES = [
			{ ...employer, category: 'Engineering', banks: [bank1] },
			{ ...consultancy, category: 'Consulting', banks: [bank2] },
			{ ...holdings, category: 'Holdings', banks: [bank2, bank3] }
		];

		// ── Account labels ──
		const SUSPECT_SALARY = `${suspect.legal_name} - Salary Account`;
		const SUSPECT_SAVINGS = `${suspect.legal_name} - Savings Account`;
		const SUSPECT_CURRENT = `${suspect.legal_name} - Current Account`;
		const SPOUSE_PERSONAL = `${spouse.legal_name} - Personal Account`;
		const COLLEAGUE_PERSONAL = `${colleague.legal_name} - Personal Account`;
		const VENDOR_ACCOUNT = `${vendor.legal_name} - Vendor Account`;
		const EMPLOYER_BUSINESS = `${employer.short_name} - Business Account`;
		const CONSULTANCY_BUSINESS = `${consultancy.short_name} - Business Account`;
		const HOLDINGS_BUSINESS = `${holdings.short_name} - Business Account`;
		const HOLDINGS_RESERVE = `${holdings.short_name} - Reserve Account`;

		// ── Account definitions (bank_id → label → owner legal_name) ──
		const ACCOUNTS: Array<{ bank_id: string; label: string; owner: string }> = [
			// Bank 1 — normal layer
			{ bank_id: bank1, label: SUSPECT_SALARY, owner: suspect.legal_name },
			{ bank_id: bank1, label: SUSPECT_SAVINGS, owner: suspect.legal_name },
			{ bank_id: bank1, label: SPOUSE_PERSONAL, owner: spouse.legal_name },
			{ bank_id: bank1, label: COLLEAGUE_PERSONAL, owner: colleague.legal_name },
			{ bank_id: bank1, label: EMPLOYER_BUSINESS, owner: employer.legal_name },
			// Bank 2 — suspicious layer
			{ bank_id: bank2, label: SUSPECT_CURRENT, owner: suspect.legal_name },
			{ bank_id: bank2, label: CONSULTANCY_BUSINESS, owner: consultancy.legal_name },
			{ bank_id: bank2, label: HOLDINGS_BUSINESS, owner: holdings.legal_name },
			{ bank_id: bank2, label: VENDOR_ACCOUNT, owner: vendor.legal_name },
			// Bank 3 — expansion layer
			{ bank_id: bank3, label: HOLDINGS_RESERVE, owner: holdings.legal_name }
		];

		// ── Transaction definitions (references account labels) ──
		// from_label and to_label must match ACCOUNTS[].label at the same bank_id
		const TRANSACTIONS: Array<{ date: string; bank_id: string; from_label: string; to_label: string; amount: string; description: string }> = [
			// ── Normal layer: salary, savings, household (Bank 1) ──
			{ date: '2024-06-25', bank_id: bank1, from_label: EMPLOYER_BUSINESS, to_label: SUSPECT_SALARY, amount: amt('45000.00'), description: 'Salary - June 2024' },
			{ date: '2024-06-26', bank_id: bank1, from_label: SUSPECT_SALARY, to_label: SUSPECT_SAVINGS, amount: amt('5000.00'), description: 'Monthly savings' },
			{ date: '2024-06-27', bank_id: bank1, from_label: SUSPECT_SALARY, to_label: SPOUSE_PERSONAL, amount: amt('3500.00'), description: 'Household contribution' },
			{ date: '2024-06-25', bank_id: bank1, from_label: EMPLOYER_BUSINESS, to_label: COLLEAGUE_PERSONAL, amount: amt('38000.00'), description: 'Salary - June 2024' },
			{ date: '2024-07-25', bank_id: bank1, from_label: EMPLOYER_BUSINESS, to_label: SUSPECT_SALARY, amount: amt('45000.00'), description: 'Salary - July 2024' },
			{ date: '2024-07-26', bank_id: bank1, from_label: SUSPECT_SALARY, to_label: SUSPECT_SAVINGS, amount: amt('5000.00'), description: 'Monthly savings' },
			{ date: '2024-07-27', bank_id: bank1, from_label: SUSPECT_SALARY, to_label: SPOUSE_PERSONAL, amount: amt('3500.00'), description: 'Household contribution' },
			{ date: '2024-07-25', bank_id: bank1, from_label: EMPLOYER_BUSINESS, to_label: COLLEAGUE_PERSONAL, amount: amt('38000.00'), description: 'Salary - July 2024' },
			{ date: '2024-08-25', bank_id: bank1, from_label: EMPLOYER_BUSINESS, to_label: SUSPECT_SALARY, amount: amt('45000.00'), description: 'Salary - August 2024' },
			{ date: '2024-08-26', bank_id: bank1, from_label: SUSPECT_SALARY, to_label: SUSPECT_SAVINGS, amount: amt('5000.00'), description: 'Monthly savings' },
			{ date: '2024-08-27', bank_id: bank1, from_label: SUSPECT_SALARY, to_label: SPOUSE_PERSONAL, amount: amt('3500.00'), description: 'Household contribution' },

			// ── Suspicious layer: holdings → consultancy → suspect (Bank 2) ──
			{ date: '2024-06-20', bank_id: bank2, from_label: HOLDINGS_BUSINESS, to_label: CONSULTANCY_BUSINESS, amount: amt('180000.00'), description: 'Project Delivery Phase 2' },
			{ date: '2024-06-22', bank_id: bank2, from_label: CONSULTANCY_BUSINESS, to_label: SUSPECT_CURRENT, amount: amt('75000.00'), description: 'Consulting Fee - June' },
			{ date: '2024-06-24', bank_id: bank2, from_label: SUSPECT_CURRENT, to_label: VENDOR_ACCOUNT, amount: amt('12000.00'), description: 'Payment - Ref TRX8842' },

			// Spouse receives transfer shortly after consultancy payment
			{ date: '2024-06-25', bank_id: bank1, from_label: SUSPECT_SALARY, to_label: SPOUSE_PERSONAL, amount: amt('15000.00'), description: 'Transfer' },

			{ date: '2024-07-18', bank_id: bank2, from_label: HOLDINGS_BUSINESS, to_label: CONSULTANCY_BUSINESS, amount: amt('95000.00'), description: 'Advisory Services Q3' },
			{ date: '2024-07-20', bank_id: bank2, from_label: CONSULTANCY_BUSINESS, to_label: SUSPECT_CURRENT, amount: amt('55000.00'), description: 'Consulting Fee - July' },
			// Spouse again shortly after
			{ date: '2024-07-22', bank_id: bank1, from_label: SUSPECT_SALARY, to_label: SPOUSE_PERSONAL, amount: amt('22000.00'), description: 'Transfer' },

			{ date: '2024-08-10', bank_id: bank2, from_label: HOLDINGS_BUSINESS, to_label: CONSULTANCY_BUSINESS, amount: amt('67000.00'), description: 'Invoice 2024-0891' },
			{ date: '2024-08-12', bank_id: bank2, from_label: CONSULTANCY_BUSINESS, to_label: SUSPECT_CURRENT, amount: amt('120000.00'), description: 'Professional Services' },
			// Large vehicle purchase inconsistent with salary
			{ date: '2024-08-14', bank_id: bank2, from_label: SUSPECT_CURRENT, to_label: VENDOR_ACCOUNT, amount: amt('85000.00'), description: 'Vehicle Deposit - BMW' },
			// Spouse again
			{ date: '2024-08-15', bank_id: bank1, from_label: SUSPECT_SALARY, to_label: SPOUSE_PERSONAL, amount: amt('18000.00'), description: 'Transfer' },

			// Blurred / generic reference
			{ date: '2024-08-20', bank_id: bank2, from_label: CONSULTANCY_BUSINESS, to_label: SUSPECT_CURRENT, amount: amt('43500.00'), description: 'Payment - Ref TRX9103' },

			// ── Investigative expansion: vendor becomes recurring, new patterns ──
			{ date: '2024-09-02', bank_id: bank2, from_label: VENDOR_ACCOUNT, to_label: SUSPECT_CURRENT, amount: amt('18500.00'), description: 'Commission Payment' },
			{ date: '2024-09-05', bank_id: bank2, from_label: VENDOR_ACCOUNT, to_label: CONSULTANCY_BUSINESS, amount: amt('32000.00'), description: 'Service Agreement' },
			{ date: '2024-09-10', bank_id: bank2, from_label: HOLDINGS_BUSINESS, to_label: CONSULTANCY_BUSINESS, amount: amt('145000.00'), description: 'Procurement Facilitation' },
			{ date: '2024-09-12', bank_id: bank2, from_label: CONSULTANCY_BUSINESS, to_label: SUSPECT_CURRENT, amount: amt('88000.00'), description: 'Consulting Fee - September' },
			{ date: '2024-09-14', bank_id: bank1, from_label: SUSPECT_SALARY, to_label: SPOUSE_PERSONAL, amount: amt('25000.00'), description: 'Transfer' },
			// Bank 3 expansion — holdings moving money across banks
			{ date: '2024-09-18', bank_id: bank3, from_label: HOLDINGS_RESERVE, to_label: HOLDINGS_RESERVE, amount: amt('250000.00'), description: 'Reserve Rebalance' }
		];

		const ENTITLEMENTS = [
			'CanCreateAccount', 'CanCreateHistoricalTransactionAtBank',
			'CanCreateCustomer', 'CanGetCustomersAtOneBank',
			'CanCreateUserCustomerLink', 'CanGetUserCustomerLink',
			'CanCreateCustomerAccountLink', 'CanCreateCustomerLink'
		];

		try {
			// ── Step 1: Create Banks ──
			logger.info('Investigation case: Creating banks...');
			for (const bankDef of BANKS) {
				try {
					const exists = await client.bankExists(bankDef.bank_id);
					if (exists) {
						results.banks.push({ ...bankDef, existed: true });
					} else {
						const bank = await client.createBank({ bank_id: bankDef.bank_id, full_name: bankDef.full_name, bank_code: bankDef.bank_code });
						results.banks.push({ bank_id: bank.bank_id, bank_code: bank.bank_code, full_name: bank.full_name, existed: false });
					}
					for (const role of ENTITLEMENTS) {
						try { await client.createEntitlement(effectiveUser.user_id, bankDef.bank_id, role); } catch { /* ignore */ }
					}
				} catch (e: any) {
					results.errors.push(`Bank ${bankDef.bank_id}: ${e.message}`);
				}
				await delay(100);
			}

			// ── Step 2: Create Accounts ──
			logger.info('Investigation case: Creating accounts...');
			// accountMap: bank_id+label → account_id (needed for transactions)
			const accountMap: Record<string, string> = {};
			for (const accDef of ACCOUNTS) {
				try {
					// Check existing
					let existingAccounts: Array<{ account_id: string; label?: string; currency?: string }> = [];
					try {
						const resp = await client.getAccountsAtBank(accDef.bank_id);
						existingAccounts = resp.accounts || [];
					} catch { /* ignore */ }

					const existing = existingAccounts.find(a => a.label === accDef.label);
					if (existing) {
						accountMap[`${accDef.bank_id}::${accDef.label}`] = existing.account_id;
						results.accounts.push({ account_id: existing.account_id, bank_id: accDef.bank_id, label: accDef.label, currency: CURRENCY, existed: true });
					} else {
						const account = await client.createAccount(accDef.bank_id, {
							label: accDef.label,
							currency: CURRENCY,
							balance: { amount: '0', currency: CURRENCY },
							user_id: effectiveUser.user_id
						});
						accountMap[`${accDef.bank_id}::${accDef.label}`] = account.account_id;
						results.accounts.push({ account_id: account.account_id, bank_id: accDef.bank_id, label: accDef.label, currency: CURRENCY, existed: false });
						logger.info(`Created account: ${accDef.label} at ${accDef.bank_id}`);
					}
				} catch (e: any) {
					results.errors.push(`Account "${accDef.label}" at ${accDef.bank_id}: ${e.message}`);
				}
				await delay(100);
			}

			// ── Step 3: Create Customers ──
			logger.info('Investigation case: Creating customers...');
			// customerMap: bank_id+legal_name → customer_id (needed for account links)
			const customerMap: Record<string, string> = {};

			for (const ind of INDIVIDUALS) {
				for (const bankId of ind.banks) {
					try {
						let existingCustomers: Array<{ customer_id: string; legal_name: string }> = [];
						try {
							const resp = await client.getCustomersAtBank(bankId);
							existingCustomers = resp.customers || [];
						} catch { /* ignore */ }

						const existing = existingCustomers.find(c => c.legal_name === ind.legal_name);
						if (existing) {
							customerMap[`${bankId}::${ind.legal_name}`] = existing.customer_id;
							results.customers.push({ customer_id: existing.customer_id, legal_name: ind.legal_name, customer_type: 'INDIVIDUAL', bank_id: bankId, existed: true });
						} else {
							const customer = await client.createCustomer(bankId, {
								legal_name: ind.legal_name,
								mobile_phone_number: ind.phone,
								email: ind.email,
								date_of_birth: ind.dob ? new Date(ind.dob).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined,
								title: ind.title,
								employment_status: ind.employment,
								highest_education_attained: ind.education || undefined,
								relationship_status: ind.relationship,
								kyc_status: true,
								credit_limit: { currency: CURRENCY, amount: amt('50000') },
								credit_rating: { rating: 'A', source: 'OBP' },
								last_ok_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
							});
							customerMap[`${bankId}::${ind.legal_name}`] = customer.customer_id;
							results.customers.push({ customer_id: customer.customer_id, legal_name: customer.legal_name, customer_type: 'INDIVIDUAL', bank_id: bankId, existed: false });
							logger.info(`Created individual customer: ${ind.legal_name} at ${bankId}`);
						}
					} catch (e: any) {
						results.errors.push(`Customer ${ind.legal_name} at ${bankId}: ${e.message}`);
					}
					await delay(100);
				}
			}

			for (const corp of CORPORATES) {
				for (const bankId of corp.banks) {
					try {
						let existingCustomers: Array<{ customer_id: string; legal_name: string }> = [];
						try {
							const resp = await client.getCustomersAtBank(bankId);
							existingCustomers = resp.customers || [];
						} catch { /* ignore */ }

						const existing = existingCustomers.find(c => c.legal_name === corp.legal_name);
						if (existing) {
							customerMap[`${bankId}::${corp.legal_name}`] = existing.customer_id;
							results.customers.push({ customer_id: existing.customer_id, legal_name: corp.legal_name, customer_type: 'CORPORATE', bank_id: bankId, existed: true });
						} else {
							const customer = await client.createCorporateCustomer(bankId, {
								legal_name: corp.legal_name,
								mobile_phone_number: corp.phone,
								email: corp.email,
								kyc_status: true,
								credit_limit: { currency: CURRENCY, amount: amt('1000000') },
								credit_rating: { rating: 'AAA', source: 'OBP' },
								last_ok_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
							});
							customerMap[`${bankId}::${corp.legal_name}`] = customer.customer_id;
							results.customers.push({ customer_id: customer.customer_id, legal_name: customer.legal_name, customer_type: 'CORPORATE', bank_id: bankId, existed: false });
							logger.info(`Created corporate customer: ${corp.legal_name} at ${bankId}`);
						}
					} catch (e: any) {
						results.errors.push(`Corporate ${corp.legal_name} at ${bankId}: ${e.message}`);
					}
					await delay(100);
				}
			}

			// ── Step 4: Create Customer-Account Links ──
			logger.info('Investigation case: Creating customer-account links...');
			for (const accDef of ACCOUNTS) {
				const accountId = accountMap[`${accDef.bank_id}::${accDef.label}`];
				const customerId = customerMap[`${accDef.bank_id}::${accDef.owner}`];
				if (!accountId || !customerId) continue;

				try {
					await client.createCustomerAccountLink(accDef.bank_id, {
						customer_id: customerId,
						bank_id: accDef.bank_id,
						account_id: accountId,
						relationship_type: 'Owner'
					});
					results.customerAccountLinks.push({ legal_name: accDef.owner, account_label: accDef.label, existed: false });
					logger.info(`Linked ${accDef.owner} → ${accDef.label}`);
				} catch (e: any) {
					results.errors.push(`Customer-Account Link ${accDef.owner} → ${accDef.label}: ${e.message}`);
				}
				await delay(100);
			}

			// ── Step 5: Create Customer Links (customer-to-customer relationships) ──
			logger.info('Investigation case: Creating customer links...');
			const CUSTOMER_LINKS: Array<{ bank_id: string; customer_name: string; other_customer_name: string; relationship_to: string }> = [
				// Suspect & spouse are married
				{ bank_id: bank1, customer_name: suspect.legal_name, other_customer_name: spouse.legal_name, relationship_to: 'spouse' },
				// Suspect is a close associate of the vendor (suspicious vendor relationship)
				{ bank_id: bank2, customer_name: suspect.legal_name, other_customer_name: vendor.legal_name, relationship_to: 'close_associate' },
				// Colleague at the employer
				{ bank_id: bank1, customer_name: suspect.legal_name, other_customer_name: colleague.legal_name, relationship_to: 'business_partner' },
			];

			for (const linkDef of CUSTOMER_LINKS) {
				const customerId = customerMap[`${linkDef.bank_id}::${linkDef.customer_name}`];
				const otherCustomerId = customerMap[`${linkDef.bank_id}::${linkDef.other_customer_name}`];
				if (!customerId || !otherCustomerId) {
					results.errors.push(`Customer link skipped — could not resolve "${linkDef.customer_name}" or "${linkDef.other_customer_name}" at ${linkDef.bank_id}`);
					continue;
				}

				try {
					await client.createCustomerLink(linkDef.bank_id, {
						customer_id: customerId,
						other_bank_id: linkDef.bank_id,
						other_customer_id: otherCustomerId,
						relationship_to: linkDef.relationship_to
					});
					results.customerLinks.push({
						customer_name: linkDef.customer_name,
						other_customer_name: linkDef.other_customer_name,
						relationship_to: linkDef.relationship_to,
						bank_id: linkDef.bank_id,
						existed: false
					});
					logger.info(`Created customer link: ${linkDef.customer_name} → ${linkDef.other_customer_name} (${linkDef.relationship_to})`);
				} catch (e: any) {
					results.errors.push(`Customer link ${linkDef.customer_name} → ${linkDef.other_customer_name}: ${e.message}`);
				}
				await delay(100);
			}

			// ── Step 6: Create Transactions ──
			logger.info('Investigation case: Creating transaction history...');
			for (const txnDef of TRANSACTIONS) {
				const fromAccountId = accountMap[`${txnDef.bank_id}::${txnDef.from_label}`];
				const toAccountId = accountMap[`${txnDef.bank_id}::${txnDef.to_label}`];
				if (!fromAccountId || !toAccountId) {
					results.errors.push(`Transaction skipped — could not resolve accounts for "${txnDef.description}" at ${txnDef.bank_id}`);
					continue;
				}

				try {
					const posted = new Date(txnDef.date).toISOString().replace(/\.\d{3}Z$/, 'Z');
					const txn = await client.createHistoricalTransaction(txnDef.bank_id, {
						from_account_id: fromAccountId,
						to_account_id: toAccountId,
						value: { currency: CURRENCY, amount: txnDef.amount },
						description: txnDef.description,
						posted,
						completed: posted
					});
					results.transactions.push({
						transaction_id: txn.transaction_id,
						bank_id: txnDef.bank_id,
						from_account_id: fromAccountId,
						to_account_id: toAccountId,
						amount: `${txnDef.amount} ${CURRENCY}`,
						existed: false,
						description: txnDef.description
					});
					logger.info(`Created transaction: ${txnDef.description} (${txnDef.amount} ${CURRENCY})`);
				} catch (e: any) {
					results.errors.push(`Transaction "${txnDef.description}": ${e.message}`);
				}
				await delay(100);
			}

			logger.info(`Investigation case complete: ${results.banks.length} banks, ${results.accounts.length} accounts, ${results.customers.length} customers, ${results.customerAccountLinks.length} account links, ${results.customerLinks.length} customer links, ${results.transactions.length} transactions`);

			return {
				success: true,
				action: 'investigationCase',
				caseCountry: countryConfig.name,
				caseCurrency: CURRENCY,
				results
			};
		} catch (e: any) {
			logger.error('Investigation case population failed:', e);
			return fail(500, { error: e.message || 'Investigation case population failed', results });
		}
	}
};
