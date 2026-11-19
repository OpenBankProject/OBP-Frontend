import { createLogger } from '$lib/utils/logger';
const logger = createLogger('CsvImportServer');
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { OBPClient } from '$lib/obp/client';
import { env } from '$env/dynamic/public';
import {
	parseBanksCsv,
	parseAccountsCsv,
	parseCustomersCsv,
	parseTransactionsCsv
} from '$lib/csv/parser';

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.session?.data?.user;
	return {
		username: user?.username || 'unknown'
	};
};

export const actions: Actions = {
	import: async ({ request, locals }) => {
		const session = locals.session;
		const accessToken = session?.data?.oauth?.access_token;
		const user = session?.data?.user;

		if (!accessToken || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const banksCsv = (formData.get('banks_csv') as string) || '';
		const accountsCsv = (formData.get('accounts_csv') as string) || '';
		const customersCsv = (formData.get('customers_csv') as string) || '';
		const transactionsCsv = (formData.get('transactions_csv') as string) || '';

		const client = new OBPClient(env.PUBLIC_OBP_BASE_URL, 'v6.0.0', accessToken);

		// Fetch current user fresh from OBP to get the authoritative user_id matching
		// the current access token (session data may be stale after token refresh or OBP DB reset)
		let currentUser: typeof user;
		try {
			currentUser = await client.getCurrentUser();
		} catch (e: any) {
			logger.error('Failed to fetch current user from OBP:', e.message);
			return fail(401, { error: `Your OBP user account could not be found. Please log out and log in again. (${e.message})` });
		}
		const effectiveUserId = currentUser.user_id;

		const results: {
			banks: Array<{ bank_id: string; name: string; status: string }>;
			accounts: Array<{ account_id: string; bank_code: string; number: string; status: string }>;
			customers: Array<{ customer_id: string; legal_name: string; customer_type: string; status: string }>;
			customerAccountLinks: Array<{ legal_name: string; number: string; status: string }>;
			transactions: Array<{ from: string; to: string; amount: string; status: string }>;
			errors: string[];
		} = {
			banks: [],
			accounts: [],
			customers: [],
			customerAccountLinks: [],
			transactions: [],
			errors: []
		};

		// Lookup maps: bank_code -> bank_id, "bank_code::label" -> account_id, etc.
		const bankIdMap: Record<string, string> = {};
		const accountIdMap: Record<string, string> = {};
		const customerIdMap: Record<string, string> = {};

		// ─── Step 1: Create Banks ──────────────────────────────────────────
		if (banksCsv.trim()) {
			const parsed = parseBanksCsv(banksCsv);
			if (parsed.errors.length > 0) {
				results.errors.push(...parsed.errors.map((e) => `banks.csv: ${e}`));
			}

			for (const row of parsed.rows) {
				const bankId = row.bank_code; // already lowercased by parser
				try {
					const exists = await client.bankExists(bankId);
					if (exists) {
						logger.info(`Bank ${bankId} already exists, reusing`);
						bankIdMap[row.bank_code] = bankId;
						results.banks.push({ bank_id: bankId, name: row.full_name, status: 'existed' });
					} else {
						const bank = await client.createBank({
							bank_id: bankId,
							full_name: row.full_name,
							bank_code: row.bank_code
						});

						// Grant entitlements at new bank
						const roles = [
							'CanCreateAccount',
							'CanCreateHistoricalTransactionAtBank',
							'CanCreateCustomer',
							'CanGetCustomersAtOneBank',
							'CanCreateUserCustomerLink',
							'CanGetUserCustomerLink',
							'CanCreateCustomerAccountLink'
						];
						for (const role of roles) {
							try {
								await client.createEntitlement(effectiveUserId, bank.bank_id, role);
							} catch (entErr: any) {
								logger.warn(`Could not grant ${role} at ${bank.bank_id}: ${entErr.message}`);
							}
						}

						bankIdMap[row.bank_code] = bank.bank_id;
						results.banks.push({ bank_id: bank.bank_id, name: row.full_name, status: 'created' });
						logger.info(`Created bank: ${bank.bank_id}`);
					}
				} catch (e: any) {
					results.errors.push(`Failed to create bank '${row.full_name}': ${e.message}`);
					logger.error(`Failed to create bank ${row.full_name}:`, e);
				}
				await delay(100);
			}
		}

		// ─── Step 2: Create Accounts ───────────────────────────────────────
		if (accountsCsv.trim()) {
			const parsed = parseAccountsCsv(accountsCsv);
			if (parsed.errors.length > 0) {
				results.errors.push(...parsed.errors.map((e) => `accounts.csv: ${e}`));
			}

			// Pre-fetch existing accounts per bank to avoid duplicates
			const existingAccountNumbers: Record<string, string> = {}; // "bank_code::number" -> account_id
			const bankCodesInCsv = [...new Set(parsed.rows.map((r) => r.bank_code))];
			for (const bankCode of bankCodesInCsv) {
				const bankId = bankIdMap[bankCode];
				if (!bankId) continue;
				try {
					const existing = await client.getAccountsAtBank(bankId);
					for (const acc of existing.accounts) {
						const numberRouting = acc.account_routings.find((r) => r.scheme === 'NUMBER');
						if (numberRouting) {
							existingAccountNumbers[`${bankCode}::${numberRouting.address}`] = acc.account_id;
						}
					}
				} catch (e) {
					logger.warn(`Could not pre-fetch accounts for bank ${bankId}`);
				}
			}

			for (const row of parsed.rows) {
				const bankId = bankIdMap[row.bank_code];
				if (!bankId) {
					results.errors.push(
						`accounts.csv: bank_code '${row.bank_code}' not found. Make sure it matches a 'bank_code' in banks.csv.`
					);
					continue;
				}

				const existingId = existingAccountNumbers[`${row.bank_code}::${row.number}`];
				if (existingId) {
					accountIdMap[`${row.bank_code}::${row.number}`] = existingId;
					results.accounts.push({ account_id: existingId, bank_code: row.bank_code, number: row.number, status: 'existed' });
					logger.info(`Account ${row.number} at ${bankId} already exists, reusing`);
					continue;
				}

				try {
					const account = await client.createAccount(bankId, {
						label: row.number,
						currency: row.currency,
						balance: { currency: row.currency, amount: '0' },
						user_id: effectiveUserId,
						account_routings: [{ scheme: 'NUMBER', address: row.number }]
					});

					accountIdMap[`${row.bank_code}::${row.number}`] = account.account_id;
					results.accounts.push({
						account_id: account.account_id,
						bank_code: row.bank_code,
						number: row.number,
						status: 'created'
					});
					logger.info(`Created account: ${row.number} at ${bankId}`);
				} catch (e: any) {
					// OBP-30115: routing already exists — account was created in a prior run.
					// Re-fetch the bank's accounts and match by label (which equals the account number).
					if (e.message?.includes('OBP-30115') || e.message?.includes('Account Routing already exist')) {
						try {
							const existing = await client.getAccountsAtBank(bankId);
							const match = existing.accounts.find(
								(a) => a.label === row.number ||
									a.account_routings?.some((r) => r.scheme === 'NUMBER' && r.address === row.number)
							);
							if (match) {
								accountIdMap[`${row.bank_code}::${row.number}`] = match.account_id;
								results.accounts.push({ account_id: match.account_id, bank_code: row.bank_code, number: row.number, status: 'existed' });
								logger.info(`Account ${row.number} at ${bankId} already existed (routing conflict), reusing ${match.account_id}`);
							} else {
								results.errors.push(`Failed to create account '${row.number}' at bank '${row.bank_code}': routing already exists but could not find the existing account.`);
							}
						} catch (fetchErr: any) {
							results.errors.push(`Failed to create account '${row.number}' at bank '${row.bank_code}': ${e.message}`);
						}
					} else {
						results.errors.push(`Failed to create account '${row.number}' at bank '${row.bank_code}': ${e.message}`);
						logger.error(`Failed to create account:`, e);
					}
				}
				await delay(100);
			}
		}

		// ─── Step 3: Create Customers ──────────────────────────────────────
		if (customersCsv.trim()) {
			const parsed = parseCustomersCsv(customersCsv);
			if (parsed.errors.length > 0) {
				results.errors.push(...parsed.errors.map((e) => `customers.csv: ${e}`));
			}

			for (const row of parsed.rows) {
				const bankId = bankIdMap[row.bank_code];
				if (!bankId) {
					results.errors.push(
						`customers.csv: bank_code '${row.bank_code}' not found for customer '${row.legal_name}'.`
					);
					continue;
				}

				try {
					let customerId: string;

					if (row.customer_type === 'corporate') {
						const customer = await client.createCorporateCustomer(bankId, {
							legal_name: row.legal_name,
							mobile_phone_number: row.mobile_phone_number,
							email: row.email,
							customer_type: 'CORPORATE',
							category: row.category
						});
						customerId = customer.customer_id;
					} else {
						const customer = await client.createCustomer(bankId, {
							legal_name: row.legal_name,
							mobile_phone_number: row.mobile_phone_number,
							email: row.email,
							date_of_birth: row.date_of_birth,
							title: row.title,
							employment_status: row.employment_status,
							highest_education_attained: row.highest_education_attained,
							relationship_status: row.relationship_status
						});
						customerId = customer.customer_id;
					}

					const key = `${row.bank_code}::${row.legal_name}`;
					customerIdMap[key] = customerId;
					results.customers.push({
						customer_id: customerId,
						legal_name: row.legal_name,
						customer_type: row.customer_type,
						status: 'created'
					});

					// Link user to customer
					try {
						await client.createUserCustomerLink(bankId, {
							user_id: effectiveUserId,
							customer_id: customerId
						});
					} catch (linkErr: any) {
						logger.warn(`Could not create user-customer link for ${row.legal_name}: ${linkErr.message}`);
					}

					logger.info(`Created ${row.customer_type} customer: ${row.legal_name} at ${bankId}`);
				} catch (e: any) {
					results.errors.push(`Failed to create customer '${row.legal_name}': ${e.message}`);
					logger.error(`Failed to create customer:`, e);
				}
				await delay(100);
			}
		}

		// ─── Step 4: Auto-link customers to accounts (via legal_name) ─────
		if (accountsCsv.trim() && customersCsv.trim()) {
			const parsedAccounts = parseAccountsCsv(accountsCsv);
			for (const row of parsedAccounts.rows) {
				if (!row.legal_name) continue;

				const bankId = bankIdMap[row.bank_code];
				const accountKey = `${row.bank_code}::${row.number}`;
				const customerKey = `${row.bank_code}::${row.legal_name}`;
				const accountId = accountIdMap[accountKey];
				const customerId = customerIdMap[customerKey];

				if (!bankId || !accountId || !customerId) {
					if (!customerId) {
						results.errors.push(
							`Could not link account '${row.number}' to customer '${row.legal_name}': customer not found at bank '${row.bank_code}'.`
						);
					}
					continue;
				}

				try {
					await client.createCustomerAccountLink(bankId, {
						customer_id: customerId,
						bank_id: bankId,
						account_id: accountId,
						relationship_type: 'Owner'
					});
					results.customerAccountLinks.push({
						legal_name: row.legal_name,
						number: row.number,
						status: 'created'
					});
					logger.info(`Linked customer '${row.legal_name}' to account '${row.number}'`);
				} catch (e: any) {
					results.errors.push(
						`Failed to link customer '${row.legal_name}' to account '${row.number}': ${e.message}`
					);
					logger.warn(`Customer-account link failed:`, e);
				}
				await delay(50);
			}
		}

		// ─── Step 5: Create Transactions ───────────────────────────────────
		if (transactionsCsv.trim()) {
			const parsed = parseTransactionsCsv(transactionsCsv);
			if (parsed.errors.length > 0) {
				results.errors.push(...parsed.errors.map((e) => `transactions.csv: ${e}`));
			}

			for (const row of parsed.rows) {
				const fromBankId = bankIdMap[row.from_bank_code];
				const fromAccountKey = `${row.from_bank_code}::${row.from_account_number}`;
				const toAccountKey = `${row.to_bank_code}::${row.to_account_number}`;
				const fromAccountId = accountIdMap[fromAccountKey];
				const toAccountId = accountIdMap[toAccountKey];

				if (!fromBankId) {
					results.errors.push(`transactions.csv: from_bank_code '${row.from_bank_code}' not found.`);
					continue;
				}
				if (!fromAccountId) {
					results.errors.push(
						`transactions.csv: from_account_number '${row.from_account_number}' at bank '${row.from_bank_code}' not found.`
					);
					continue;
				}
				if (!toAccountId) {
					results.errors.push(
						`transactions.csv: to_account_number '${row.to_account_number}' at bank '${row.to_bank_code}' not found.`
					);
					continue;
				}

				const postedDate = new Date(row.date).toISOString().replace(/\.\d{3}Z$/, 'Z');

				try {
					await client.createHistoricalTransaction(fromBankId, {
						from_account_id: fromAccountId,
						to_account_id: toAccountId,
						value: {
							currency: row.currency,
							amount: row.amount
						},
						description: row.description || 'CSV import',
						posted: postedDate,
						completed: postedDate,
						type: 'SANDBOX_TAN',
						charge_policy: 'SHARED'
					});
					results.transactions.push({
						from: `${row.from_bank_code}/${row.from_account_number}`,
						to: `${row.to_bank_code}/${row.to_account_number}`,
						amount: `${row.amount} ${row.currency}`,
						status: 'created'
					});
					logger.info(`Created transaction: ${row.amount} ${row.currency}`);
				} catch (e: any) {
					results.errors.push(
						`Failed to create transaction (${row.from_account_number} -> ${row.to_account_number}, ${row.amount} ${row.currency}): ${e.message}`
					);
					logger.error(`Failed to create transaction:`, e);
				}
				await delay(100);
			}
		}

		const totalCreated =
			results.banks.filter((b) => b.status === 'created').length +
			results.accounts.filter((a) => a.status === 'created').length +
			results.customers.filter((c) => c.status === 'created').length +
			results.customerAccountLinks.filter((l) => l.status === 'created').length +
			results.transactions.filter((t) => t.status === 'created').length;

		logger.info(`CSV import complete. ${totalCreated} entities created, ${results.errors.length} errors.`);

		return { results };
	}
};
