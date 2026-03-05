import type { BaseMessage, AssistantMessage, ToolMessage } from '$lib/opey/types';

function getToolDisplayName(toolName: string): string {
	switch (toolName) {
		case 'retrieve_endpoints':
			return 'Endpoint Retrieval';
		case 'retrieve_glossary':
			return 'Glossary Retrieval';
		case 'list_endpoints_by_tag':
			return 'List Endpoints by Tag';
		case 'obp_requests':
			return 'OBP API Request';
		default:
			return toolName
				.replace(/_/g, ' ')
				.replace(/\b\w/g, (l) => l.toUpperCase());
	}
}

function getToolStatus(tool: ToolMessage): string {
	if (tool.status === 'error') return 'Error';
	if (tool.approvalStatus === 'denied') return 'Denied';
	if (tool.consentStatus === 'denied') return 'Consent Denied';
	if (tool.waitingForConsent) return 'Awaiting Consent';
	if (tool.waitingForApproval) return 'Awaiting Approval';
	if (tool.toolOutput) return 'Success';
	return 'Pending';
}

function formatTimestamp(date: Date): string {
	const d = date instanceof Date ? date : new Date(date);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatToolOutput(output: unknown): string {
	if (output === undefined || output === null) return '';
	if (typeof output === 'string') {
		// Try to parse as JSON for pretty-printing
		try {
			const parsed = JSON.parse(output);
			return JSON.stringify(parsed, null, 2);
		} catch {
			return output;
		}
	}
	return JSON.stringify(output, null, 2);
}

function renderToolBlock(tool: ToolMessage): string {
	const displayName = getToolDisplayName(tool.toolName);
	const status = getToolStatus(tool);
	const lines: string[] = [];

	lines.push(`<details>`);
	lines.push(`<summary>Tool: ${displayName} — ${status}</summary>`);
	lines.push('');

	if (tool.toolInput && Object.keys(tool.toolInput).length > 0) {
		lines.push('**Input:**');
		lines.push('```json');
		lines.push(JSON.stringify(tool.toolInput, null, 2));
		lines.push('```');
		lines.push('');
	}

	if (tool.status === 'error' && tool.error) {
		lines.push(`**Error:** ${tool.error}`);
		lines.push('');
	} else if (tool.toolOutput !== undefined && tool.toolOutput !== null) {
		lines.push('**Output:**');
		lines.push('```json');
		lines.push(formatToolOutput(tool.toolOutput));
		lines.push('```');
		lines.push('');
	}

	lines.push('</details>');
	return lines.join('\n');
}

/**
 * Build a lookup map of toolCallId -> ToolMessage for fast access.
 */
function buildToolMap(messages: BaseMessage[]): Map<string, ToolMessage> {
	const map = new Map<string, ToolMessage>();
	for (const msg of messages) {
		if (msg.role === 'tool') {
			const tool = msg as ToolMessage;
			map.set(tool.toolCallId, tool);
		}
	}
	return map;
}

/**
 * Render a single assistant message (with its associated tool calls) to markdown.
 */
function renderAssistantMessage(
	msg: AssistantMessage,
	toolMap: Map<string, ToolMessage>,
	consumedToolIds: Set<string>
): string {
	const lines: string[] = [];
	lines.push(`**Opey** _${formatTimestamp(msg.timestamp)}_`);
	lines.push('');

	// Render tool calls first
	if (msg.toolCalls && msg.toolCalls.length > 0) {
		for (const tc of msg.toolCalls) {
			const toolMsg = toolMap.get(tc.id);
			if (toolMsg) {
				consumedToolIds.add(toolMsg.id);
				lines.push(renderToolBlock(toolMsg));
				lines.push('');
			}
		}
	}

	// Render the text content
	if (msg.message && msg.message.trim()) {
		lines.push(msg.message);
	}

	return lines.join('\n');
}

/**
 * Serialize the full conversation to markdown.
 */
export function chatToMarkdown(messages: BaseMessage[]): string {
	const toolMap = buildToolMap(messages);
	const consumedToolIds = new Set<string>();
	const sections: string[] = [];

	sections.push('# Chat Transcript');
	sections.push('');

	for (const msg of messages) {
		// Skip tool messages — they're rendered inline with their parent assistant message
		if (msg.role === 'tool') {
			if (consumedToolIds.has(msg.id)) continue;
			// Orphan tool message (no parent assistant) — render standalone
			const tool = msg as ToolMessage;
			consumedToolIds.add(msg.id);
			sections.push('---');
			sections.push('');
			sections.push(`**Opey** _${formatTimestamp(msg.timestamp)}_`);
			sections.push('');
			sections.push(renderToolBlock(tool));
			sections.push('');
			continue;
		}

		sections.push('---');
		sections.push('');

		if (msg.role === 'user') {
			sections.push(`**User** _${formatTimestamp(msg.timestamp)}_`);
			sections.push('');
			sections.push(msg.message);
			sections.push('');
		} else if (msg.role === 'assistant') {
			sections.push(
				renderAssistantMessage(msg as AssistantMessage, toolMap, consumedToolIds)
			);
			sections.push('');
		} else if (msg.role === 'error') {
			sections.push(`**Error** _${formatTimestamp(msg.timestamp)}_`);
			sections.push('');
			sections.push(msg.error || msg.message);
			sections.push('');
		}
	}

	return sections.join('\n').trimEnd() + '\n';
}

/**
 * Serialize a single message to markdown.
 * For assistant messages, includes associated tool messages from allMessages.
 */
export function messageToMarkdown(
	message: BaseMessage,
	allMessages: BaseMessage[]
): string {
	if (message.role === 'user') {
		const lines = [
			`**User** _${formatTimestamp(message.timestamp)}_`,
			'',
			message.message,
			''
		];
		return lines.join('\n').trimEnd() + '\n';
	}

	if (message.role === 'assistant') {
		const toolMap = buildToolMap(allMessages);
		const consumedToolIds = new Set<string>();
		const content = renderAssistantMessage(
			message as AssistantMessage,
			toolMap,
			consumedToolIds
		);
		return content.trimEnd() + '\n';
	}

	if (message.role === 'error') {
		const lines = [
			`**Error** _${formatTimestamp(message.timestamp)}_`,
			'',
			message.error || message.message,
			''
		];
		return lines.join('\n').trimEnd() + '\n';
	}

	// Tool messages rendered standalone
	if (message.role === 'tool') {
		const tool = message as ToolMessage;
		const lines = [
			`**Opey** _${formatTimestamp(message.timestamp)}_`,
			'',
			renderToolBlock(tool),
			''
		];
		return lines.join('\n').trimEnd() + '\n';
	}

	return message.message + '\n';
}
