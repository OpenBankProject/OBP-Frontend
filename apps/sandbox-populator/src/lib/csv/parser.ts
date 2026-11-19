/**
 * CSV parser for OBP sandbox data import.
 *
 * CSV column names match OBP API v6.0.0 JSON field names.
 */

// ─── Row types (field names match OBP API JSON) ────────────────────────────

export interface CsvBankRow {
	full_name: string;
	bank_code: string;
}

export interface CsvAccountRow {
	bank_code: string;
	number: string;
	currency: string;
	legal_name?: string; // references a customer's legal_name for auto-linking
}

export interface CsvCustomerRow {
	legal_name: string;
	customer_type: string; // 'individual' or 'corporate'
	mobile_phone_number: string;
	email?: string;
	date_of_birth?: string;
	title?: string;
	employment_status?: string;
	highest_education_attained?: string;
	relationship_status?: string;
	category?: string; // for corporate
	bank_code: string;
}

export interface CsvTransactionRow {
	date: string;
	from_account_number: string;
	from_bank_code: string;
	to_account_number: string;
	to_bank_code: string;
	amount: string;
	currency: string;
	description?: string;
}

// ─── Parsed CSV result with validation ─────────────────────────────────────

export interface CsvParseResult<T> {
	rows: T[];
	errors: string[];
	headers: string[];
}

// ─── Core CSV parser ───────────────────────────────────────────────────────

function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
	const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
	if (lines.length === 0) return { headers: [], rows: [] };

	const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
	const rows: Record<string, string>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = parseCsvLine(lines[i]);
		const row: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			row[headers[j]] = (values[j] || '').trim();
		}
		rows.push(row);
	}

	return { headers, rows };
}

/** Parse a single CSV line handling quoted fields */
function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (inQuotes) {
			if (char === '"') {
				if (i + 1 < line.length && line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += char;
			}
		} else {
			if (char === '"') {
				inQuotes = true;
			} else if (char === ',') {
				result.push(current);
				current = '';
			} else {
				current += char;
			}
		}
	}
	result.push(current);
	return result;
}

// ─── Typed parsers for each CSV type ───────────────────────────────────────

export function parseBanksCsv(text: string): CsvParseResult<CsvBankRow> {
	const { headers, rows } = parseCsvText(text);
	const errors: string[] = [];
	const parsed: CsvBankRow[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const lineNum = i + 2;
		if (!row.full_name) errors.push(`Row ${lineNum}: missing 'full_name'`);
		if (!row.bank_code) errors.push(`Row ${lineNum}: missing 'bank_code'`);
		if (row.bank_code && row.bank_code.length <= 3) errors.push(`Row ${lineNum}: 'bank_code' must be more than 3 characters (OBP requirement)`);
		if (row.full_name && row.bank_code && row.bank_code.length > 3) {
			parsed.push({
				full_name: row.full_name,
				bank_code: row.bank_code.toLowerCase()
			});
		}
	}

	return { rows: parsed, errors, headers };
}

export function parseAccountsCsv(text: string): CsvParseResult<CsvAccountRow> {
	const { headers, rows } = parseCsvText(text);
	const errors: string[] = [];
	const parsed: CsvAccountRow[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const lineNum = i + 2;
		if (!row.bank_code) errors.push(`Row ${lineNum}: missing 'bank_code'`);
		if (row.bank_code && row.bank_code.length <= 3) errors.push(`Row ${lineNum}: 'bank_code' must be more than 3 characters (OBP requirement)`);
		if (!row.number) errors.push(`Row ${lineNum}: missing 'number'`);
		if (!row.currency) errors.push(`Row ${lineNum}: missing 'currency'`);
		if (row.bank_code && row.bank_code.length > 3 && row.number && row.currency) {
			parsed.push({
				bank_code: row.bank_code.toLowerCase(),
				number: row.number,
				currency: row.currency,
				legal_name: row.legal_name || undefined
			});
		}
	}

	return { rows: parsed, errors, headers };
}

export function parseCustomersCsv(text: string): CsvParseResult<CsvCustomerRow> {
	const { headers, rows } = parseCsvText(text);
	const errors: string[] = [];
	const parsed: CsvCustomerRow[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const lineNum = i + 2;
		if (!row.legal_name) errors.push(`Row ${lineNum}: missing 'legal_name'`);
		if (!row.customer_type) errors.push(`Row ${lineNum}: missing 'customer_type'`);
		if (!row.mobile_phone_number) errors.push(`Row ${lineNum}: missing 'mobile_phone_number'`);
		if (!row.bank_code) errors.push(`Row ${lineNum}: missing 'bank_code'`);
		if (row.bank_code && row.bank_code.length <= 3) errors.push(`Row ${lineNum}: 'bank_code' must be more than 3 characters (OBP requirement)`);
		if (row.customer_type && !['individual', 'corporate'].includes(row.customer_type.toLowerCase())) {
			errors.push(`Row ${lineNum}: 'customer_type' must be 'individual' or 'corporate'`);
		}
		if (row.legal_name && row.customer_type && row.mobile_phone_number && row.bank_code && row.bank_code.length > 3) {
			parsed.push({
				legal_name: row.legal_name,
				customer_type: row.customer_type.toLowerCase(),
				mobile_phone_number: row.mobile_phone_number,
				email: row.email || undefined,
				date_of_birth: row.date_of_birth || undefined,
				title: row.title || undefined,
				employment_status: row.employment_status || undefined,
				highest_education_attained: row.highest_education_attained || undefined,
				relationship_status: row.relationship_status || undefined,
				category: row.category || undefined,
				bank_code: row.bank_code.toLowerCase()
			});
		}
	}

	return { rows: parsed, errors, headers };
}

export function parseTransactionsCsv(text: string): CsvParseResult<CsvTransactionRow> {
	const { headers, rows } = parseCsvText(text);
	const errors: string[] = [];
	const parsed: CsvTransactionRow[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const lineNum = i + 2;
		if (!row.date) errors.push(`Row ${lineNum}: missing 'date'`);
		if (!row.from_account_number) errors.push(`Row ${lineNum}: missing 'from_account_number'`);
		if (!row.from_bank_code) errors.push(`Row ${lineNum}: missing 'from_bank_code'`);
		if (row.from_bank_code && row.from_bank_code.length <= 3) errors.push(`Row ${lineNum}: 'from_bank_code' must be more than 3 characters (OBP requirement)`);
		if (row.to_bank_code && row.to_bank_code.length <= 3) errors.push(`Row ${lineNum}: 'to_bank_code' must be more than 3 characters (OBP requirement)`);
		if (!row.to_account_number) errors.push(`Row ${lineNum}: missing 'to_account_number'`);
		if (!row.to_bank_code) errors.push(`Row ${lineNum}: missing 'to_bank_code'`);
		if (!row.amount) errors.push(`Row ${lineNum}: missing 'amount'`);
		if (!row.currency) errors.push(`Row ${lineNum}: missing 'currency'`);
		if (row.amount && isNaN(parseFloat(row.amount))) {
			errors.push(`Row ${lineNum}: 'amount' must be a number`);
		}
		if (row.date && isNaN(new Date(row.date).getTime())) {
			errors.push(`Row ${lineNum}: 'date' is not a valid date (expected YYYY-MM-DD)`);
		}
		const dateValid = !row.date || !isNaN(new Date(row.date).getTime());
		const amountValid = !row.amount || !isNaN(parseFloat(row.amount));
		if (row.date && row.from_account_number && row.from_bank_code && row.to_account_number && row.to_bank_code && row.amount && row.currency && dateValid && amountValid) {
			parsed.push({
				date: row.date,
				from_account_number: row.from_account_number,
				from_bank_code: row.from_bank_code.toLowerCase(),
				to_account_number: row.to_account_number,
				to_bank_code: row.to_bank_code.toLowerCase(),
				amount: row.amount,
				currency: row.currency,
				description: row.description || undefined
			});
		}
	}

	return { rows: parsed, errors, headers };
}
