import { describe, expect, it } from 'vitest';
import { DEFAULT_EMAIL_SETTINGS, emailSettingsOf } from './emailSettings';
import { planReminders } from './reminders';

describe('emailSettingsOf', () => {
	it('is the defaults without a record, and reads switches and days carefully', () => {
		expect(emailSettingsOf(null)).toEqual(DEFAULT_EMAIL_SETTINGS);
		expect(emailSettingsOf({ decision: false, call_closing: 'no', due_soon_days: 14, closing_soon_days: 500 })).toEqual({
			...DEFAULT_EMAIL_SETTINGS,
			decision: false,
			due_soon_days: 14
		});
	});
});

describe('planReminders with kinds switched off', () => {
	it('plans only the kinds left on', () => {
		const input = {
			today: '2027-03-01',
			milestones: [{ id: 'm', programme_id: 'p', title: 'MVP', description: '', due_on: '2027-02-01', position: 1 }],
			participants: [{ id: 'part', programme_id: 'p', startup_name: 'S', status: 'active', customer_id: 'c' }],
			reports: [],
			reviews: [],
			drafts: [],
			calls: [],
			sent: new Set<string>()
		};
		expect(planReminders(input).map((r) => r.kind)).toEqual(['milestone_overdue']);
		expect(planReminders({ ...input, kinds: ['milestone_due'] })).toEqual([]);
	});
});
