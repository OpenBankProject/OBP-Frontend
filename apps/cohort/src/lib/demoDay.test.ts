import { describe, expect, it } from 'vitest';
import { demoGuestOf, demoSlotOf, guestCounts, nextPosition, runningOrder } from './demoDay';

describe('demo day', () => {
	const slots = [
		demoSlotOf('b', { session_id: 's', participant_id: 'p2', position: 2, starts_at: '10:20' }),
		demoSlotOf('a', { session_id: 's', participant_id: 'p1', position: 1, starts_at: '10:10' }),
		demoSlotOf('c', { session_id: 's', participant_id: 'p3', position: 'x', starts_at: '' })
	];

	it('orders the running order by position and gives the next free one', () => {
		expect(runningOrder(slots).map((x) => x.id)).toEqual(['c', 'a', 'b']);
		expect(nextPosition(slots)).toBe(3);
		expect(nextPosition([])).toBe(1);
	});

	it('reads guests carefully and counts them by status', () => {
		const guests = [demoGuestOf('1', { status: 'confirmed' }), demoGuestOf('2', { status: 'maybe' }), demoGuestOf('3', {})];
		expect(guests.map((g) => g.status)).toEqual(['confirmed', 'invited', 'invited']);
		expect(guestCounts(guests)).toEqual({ invited: 2, confirmed: 1, declined: 0 });
	});
});
