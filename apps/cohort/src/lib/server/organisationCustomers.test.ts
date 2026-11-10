import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./obp', () => ({ obpRequests: { get: vi.fn() } }));

const { obpRequests } = await import('./obp');
const { organisationCustomers } = await import('./organisationCustomers');
const get = vi.mocked(obpRequests.get);

const page = (n: number, from = 0) => ({
	customers: Array.from({ length: n }, (_, i) => ({ customer_id: `c-${from + i}` }))
});

describe('organisationCustomers', () => {
	beforeEach(() => get.mockReset());

	it('reads every page of the attribute-filtered Customers, not only the first 50', async () => {
		get.mockResolvedValueOnce(page(200)).mockResolvedValueOnce(page(3, 200));
		const customers = await organisationCustomers(
			'cohort',
			'organisation_kind=bank_fi,university',
			'token-1'
		);
		expect(customers).toHaveLength(203);
		expect(get).toHaveBeenNthCalledWith(
			1,
			'/obp/v7.0.0/banks/cohort/customers?organisation_kind=bank_fi,university&limit=200&offset=0',
			'token-1'
		);
		expect(get).toHaveBeenNthCalledWith(
			2,
			'/obp/v7.0.0/banks/cohort/customers?organisation_kind=bank_fi,university&limit=200&offset=200',
			'token-1'
		);
		expect(get).toHaveBeenCalledTimes(2);
	});

	it('stops after a page that is not full, and when a page is empty', async () => {
		get.mockResolvedValueOnce(page(0));
		expect(await organisationCustomers('cohort', 'organisation_kind=partner', 'token-1')).toEqual(
			[]
		);
		expect(get).toHaveBeenCalledTimes(1);
	});
});
