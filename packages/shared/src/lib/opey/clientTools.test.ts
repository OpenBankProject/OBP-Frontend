/**
 * Client-executed tool flow: RestChatService wire parsing + resume payload,
 * and ChatController execution semantics (the graph must NEVER be left
 * hanging — every client_tool_call gets a result, even on failure).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestChatService } from './services/RestChatService';
import { ChatController } from './controllers/ChatController';
import { ChatState } from './state/ChatState';
import type { ChatService, StreamEvent } from './services/ChatService';
import type { ToolMessage } from './types';

describe('RestChatService client tool wiring', () => {
	let service: RestChatService;
	let events: StreamEvent[];

	beforeEach(() => {
		service = new RestChatService('/backend/opey', undefined, () => ({
			client_tools: ['set_form_fields'],
			client_context: 'form: create-dynamic-resource-doc'
		}));
		events = [];
		service.onStreamEvent((e) => events.push(e));
	});

	it('parses a client_tool_call wire event into camelCase', () => {
		(service as any).handleStreamEvent({
			type: 'client_tool_call',
			tool_call_id: 'call_1',
			tool_name: 'set_form_fields',
			tool_input: { fields: { summary: 'x' }, note: '' }
		});
		expect(events).toEqual([
			{
				type: 'client_tool_call',
				toolCallId: 'call_1',
				toolName: 'set_form_fields',
				toolInput: { fields: { summary: 'x' }, note: '' }
			}
		]);
	});

	it('sendClientToolResult posts to /stream with the resume payload and re-declares client_tools', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response('data: [DONE]\n\n', { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);

		await service.sendClientToolResult('call_1', 'applied', { applied: ['summary'] }, 'thread-1');

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/backend/opey/stream');
		const body = JSON.parse(init.body);
		expect(body.thread_id).toBe('thread-1');
		expect(body.tool_call_approval.client_tool_result).toEqual({
			tool_call_id: 'call_1',
			status: 'applied',
			result: { applied: ['summary'] }
		});
		// The graph is rebuilt per request — capabilities must ride along.
		expect(body.client_tools).toEqual(['set_form_fields']);
		vi.unstubAllGlobals();
	});
});

/** Minimal ChatService double: captures results, replays no stream. */
function fakeService() {
	let streamCallback: ((e: StreamEvent) => void) | undefined;
	const sent: any[] = [];
	const svc: ChatService = {
		send: vi.fn(),
		sendApproval: vi.fn(),
		sendBatchApproval: vi.fn(),
		sendConsentResponse: vi.fn(),
		sendClientToolResult: vi.fn(async (toolCallId, status, result, threadId) => {
			sent.push({ toolCallId, status, result, threadId });
		}),
		regenerate: vi.fn(),
		onStreamEvent: (fn) => (streamCallback = fn),
		onError: vi.fn(),
		cancel: vi.fn()
	};
	return { svc, sent, emit: (e: StreamEvent) => streamCallback?.(e) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('ChatController client tool execution', () => {
	it('executes the registered handler and reports applied', async () => {
		const { svc, sent, emit } = fakeService();
		const state = new ChatState();
		const controller = new ChatController(svc, state);
		controller.setClientToolHandlers({
			set_form_fields: async (input) => ({ applied: Object.keys(input.fields), ignored: [] })
		});

		emit({ type: 'thread_sync', threadId: 't1' });
		emit({
			type: 'client_tool_call',
			toolCallId: 'call_1',
			toolName: 'set_form_fields',
			toolInput: { fields: { summary: 'x', bogus: 'y' } }
		});
		await flush();

		expect(sent).toEqual([
			{ toolCallId: 'call_1', status: 'applied', result: { applied: ['summary', 'bogus'], ignored: [] }, threadId: 't1' }
		]);
		const msg = state.getToolMessageByCallId('call_1') as ToolMessage;
		expect(msg.clientExecuted).toBe(true);
		expect(msg.clientResult).toEqual({ status: 'applied', applied: ['summary', 'bogus'], ignored: [] });
	});

	it('reports an error result when no handler is registered — never leaves the graph hanging', async () => {
		const { svc, sent, emit } = fakeService();
		const controller = new ChatController(svc, new ChatState());
		controller.setClientToolHandlers({});

		emit({ type: 'client_tool_call', toolCallId: 'call_2', toolName: 'set_form_fields', toolInput: {} });
		await flush();

		expect(sent).toHaveLength(1);
		expect(sent[0].status).toBe('error');
		expect(sent[0].toolCallId).toBe('call_2');
	});

	it('reports an error result when the handler throws', async () => {
		const { svc, sent, emit } = fakeService();
		const state = new ChatState();
		const controller = new ChatController(svc, state);
		controller.setClientToolHandlers({
			set_form_fields: async () => {
				throw new Error('form is gone');
			}
		});

		emit({ type: 'client_tool_call', toolCallId: 'call_3', toolName: 'set_form_fields', toolInput: {} });
		await flush();

		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({
			toolCallId: 'call_3',
			status: 'error',
			result: { error: 'form is gone' }
		});
		expect((state.getToolMessageByCallId('call_3') as ToolMessage).clientResult?.status).toBe('error');
	});
});

describe('ChatState.subscribe', () => {
	it('returns a working unsubscribe function', () => {
		const state = new ChatState();
		const seen: number[] = [];
		const unsub = state.subscribe((snap) => seen.push(snap.messages.length));
		expect(seen).toEqual([0]); // fired immediately
		state.addMessage({ id: 'm1', role: 'assistant', message: 'hi', timestamp: new Date() });
		expect(seen).toEqual([0, 1]);
		unsub();
		state.addMessage({ id: 'm2', role: 'assistant', message: 'bye', timestamp: new Date() });
		expect(seen).toEqual([0, 1]); // no longer notified
	});
});
