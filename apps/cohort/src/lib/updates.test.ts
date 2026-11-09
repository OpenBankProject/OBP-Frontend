import { describe, expect, it } from 'vitest';
import { updatesFeed, type UpdatesInput } from './updates';

const base: UpdatesInput = { announcements: [], outcomes: [], reviews: [], sessions: [], milestones: [], now: '2027-03-01T09:00', today: '2027-03-01', seenAt: '' };

describe('updatesFeed', () => {
	it('lists announcements, outcomes and milestone reviews newest first, marking those after the last look as new', () => {
		const { recent } = updatesFeed({
			...base,
			seenAt: '2027-02-15T00:00:00Z',
			announcements: [{ id: 'a1', title: 'Demo day', body: 'In June', published_at: '2027-02-20T09:00:00Z' }],
			outcomes: [
				{ application_id: 'app', call: 'Spring call', decision: 'accepted', message: 'Welcome', decided_at: '2027-02-10T09:00:00Z' },
				{ application_id: 'draft', call: 'Spring call', decision: '', message: '', decided_at: '' }
			],
			reviews: [{ report_id: 'r1', milestone: 'MVP', decision: 'returned', message: 'Add evidence', decided_at: '2027-02-25T09:00:00Z' }]
		});
		expect(recent.map((u) => [u.kind, u.title, u.new])).toEqual([
			['milestone_review', 'MVP', true],
			['announcement', 'Demo day', true],
			['decision', 'Spring call', false]
		]);
		expect(recent[2]).toMatchObject({ outcome: 'accepted', href: '/applications/app' });
	});

	it('everything is new to a User who never looked', () => {
		const { recent } = updatesFeed({ ...base, announcements: [{ id: 'a1', title: 'Hi', body: '', published_at: '2020-01-01T00:00:00Z' }] });
		expect(recent[0].new).toBe(true);
	});

	it('shows booked sessions and open milestones of the coming week, and overdue ones, soonest first', () => {
		const { upcoming } = updatesFeed({
			...base,
			sessions: [
				{ id: 's-past', title: 'Past', starts_at: '2027-02-28T10:00' },
				{ id: 's-soon', title: 'Mentoring', starts_at: '2027-03-03T10:00' },
				{ id: 's-later', title: 'Later', starts_at: '2027-04-01T10:00' }
			],
			milestones: [
				{ id: 'm1', participant_id: 'p', title: 'Overdue', due_on: '2027-02-20', status: 'not_started', behind: true },
				{ id: 'm2', participant_id: 'p', title: 'Due soon', due_on: '2027-03-05', status: 'returned', behind: false },
				{ id: 'm3', participant_id: 'p', title: 'Sent in', due_on: '2027-03-04', status: 'submitted', behind: false },
				{ id: 'm4', participant_id: 'p', title: 'Far off', due_on: '2027-06-01', status: 'not_started', behind: false }
			]
		});
		expect(upcoming.map((u) => [u.kind, u.title])).toEqual([
			['milestone_overdue', 'Overdue'],
			['session_soon', 'Mentoring'],
			['milestone_due', 'Due soon']
		]);
	});
});
