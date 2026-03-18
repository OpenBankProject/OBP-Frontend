# Quick Reference: Tool Approval Implementation

## Backend Event Format (Python)

```python
yield StreamEventFactory.approval_request(
    tool_name="delete_customer",
    tool_call_id="call_abc123",
    tool_input={"customer_id": "12345"},
    message="Delete customer John Doe (ID: 12345)",
    risk_level="high",
    affected_resources=["customer:12345", "orders:67890"],
    reversible=False,
    estimated_impact="This will permanently delete the customer and all associated orders",
    similar_operations_count=3,
    available_approval_levels=["user", "admin", "super_admin"],
    default_approval_level="admin"
)
```

## Frontend Event Structure (TypeScript)

```typescript
{
  type: 'approval_request',
  toolCallId: string,
  toolName: string,
  toolInput: Record<string, any>,
  message: string,
  riskLevel: string,
  affectedResources: string[],
  reversible: boolean,
  estimatedImpact: string,
  similarOperationsCount: number,
  availableApprovalLevels: string[],
  defaultApprovalLevel: string
}
```

## Approval Request Payload (Frontend → Backend)

```json
{
  "tool_call_id": "call_abc123",
  "approval": "approve",
  "approval_level": "admin"
}
```

## Complete UI Example

```svelte
<script lang="ts">
  import type { ChatStateSnapshot } from '$lib/opey/state/ChatState';
  import { ChatController } from '$lib/opey/controllers/ChatController';
  import ToolApprovalCard from '$lib/components/ToolApprovalCard.svelte';
  
  let chatController: ChatController;
  let chat: ChatStateSnapshot = $state({ threadId: '', messages: [] });
  
  // Subscribe to chat state
  $effect(() => {
    chatController.state.subscribe((snapshot) => {
      chat = snapshot;
    });
  });
  
  async function handleApprove(toolCallId: string, approvalLevel?: string) {
    try {
      await chatController.approveToolCall(toolCallId, approvalLevel);
    } catch (error) {
      console.error('Approval failed:', error);
      // Error handling already done in controller
    }
  }
  
  async function handleDeny(toolCallId: string) {
    try {
      await chatController.denyToolCall(toolCallId);
    } catch (error) {
      console.error('Denial failed:', error);
    }
  }
</script>

<div class="chat-container">
  {#each chat.messages as message}
    {#if message.role === 'tool' && message.waitingForApproval}
      <ToolApprovalCard 
        toolMessage={message}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
    {/if}
  {/each}
</div>
```

## Available Fields on ToolMessage

```typescript
interface ToolMessage {
  // Core fields
  id: string;
  role: 'tool';
  toolName: string;
  toolCallId: string;
  toolInput: Record<string, any>;
  
  // Status fields
  waitingForApproval?: boolean;
  approvalStatus?: 'approved' | 'denied';
  approvalLevel?: string;
  isStreaming?: boolean;
  status?: 'success' | 'error';
  toolOutput?: any;
  
  // Approval metadata
  approvalMessage?: string;  // Human-readable description
  riskLevel?: string;        // 'low' | 'medium' | 'high' | 'critical'
  affectedResources?: string[];
  reversible?: boolean;
  estimatedImpact?: string;
  similarOperationsCount?: number;
  availableApprovalLevels?: string[];
  defaultApprovalLevel?: string;
  
  // Display
  instanceNumber?: number;
  timestamp: Date;
  message: string;
  error?: string;
}
```

## State Transitions

```
1. approval_request received
   → waitingForApproval: true
   → approvalStatus: undefined

2. User clicks "Approve"
   → waitingForApproval: false
   → approvalStatus: 'approved'
   → approvalLevel: 'user' (or selected level)

3. tool_start received (backend confirms)
   → isStreaming: true

4. tool_complete received
   → isStreaming: false
   → status: 'success' | 'error'
   → toolOutput: {...}
```

## API Methods

### ChatController

```typescript
// Approve with default level
await chatController.approveToolCall(toolCallId);

// Approve with specific level
await chatController.approveToolCall(toolCallId, 'admin');

// Deny
await chatController.denyToolCall(toolCallId);
```

### ChatService (Internal)

```typescript
// Send approval to backend
await chatService.sendApproval(
  toolCallId,
  true,  // approved
  threadId,
  'admin'  // optional approval level
);
```

### ChatState (Internal)

```typescript
// Add approval request
chatState.addApprovalRequest(
  toolCallId,
  toolName,
  toolInput,
  approvalMessage,
  {
    riskLevel,
    affectedResources,
    reversible,
    estimatedImpact,
    similarOperationsCount,
    availableApprovalLevels,
    defaultApprovalLevel
  }
);

// Update approval status
chatState.updateApprovalRequest(toolCallId, true);

// Update tool message
chatState.updateToolMessage(toolCallId, {
  approvalStatus: 'approved',
  approvalLevel: 'admin'
});
```

## Common Patterns

### Display Approval Status

```svelte
{#if message.waitingForApproval}
  <span class="badge warning">Waiting for approval</span>
{:else if message.approvalStatus === 'approved'}
  <span class="badge success">
    Approved {message.approvalLevel ? `(${message.approvalLevel})` : ''}
  </span>
{:else if message.approvalStatus === 'denied'}
  <span class="badge error">Denied</span>
{/if}
```

### Risk-Based Styling

```svelte
<script>
  const riskStyles = {
    low: 'bg-success-100 text-success-900',
    medium: 'bg-warning-100 text-warning-900',
    high: 'bg-error-100 text-error-900',
    critical: 'bg-error-200 text-error-950'
  };
  
  const style = message.riskLevel 
    ? riskStyles[message.riskLevel.toLowerCase()]
    : riskStyles.medium;
</script>

<span class="badge {style}">
  {message.riskLevel?.toUpperCase()} RISK
</span>
```

### Approval Level Selector

```svelte
{#if message.availableApprovalLevels?.length > 1}
  <select bind:value={selectedLevel}>
    {#each message.availableApprovalLevels as level}
      <option value={level} selected={level === message.defaultApprovalLevel}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </option>
    {/each}
  </select>
{/if}
```

## Error Handling

```typescript
async function handleApprove(toolCallId: string, level?: string) {
  try {
    await chatController.approveToolCall(toolCallId, level);
    // Success feedback handled by state updates
  } catch (error) {
    // Error already logged and state reverted by controller
    // Optionally show user-friendly error toast
    showToast('Failed to send approval. Please try again.', 'error');
  }
}
```

## Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ChatController } from '$lib/opey/controllers/ChatController';

describe('Tool Approval', () => {
  it('should approve tool with custom level', async () => {
    const mockService = {
      sendApproval: vi.fn().mockResolvedValue(undefined)
    };
    
    const controller = new ChatController(mockService, chatState);
    
    await controller.approveToolCall('call_123', 'admin');
    
    expect(mockService.sendApproval).toHaveBeenCalledWith(
      'call_123',
      true,
      expect.any(String),
      'admin'
    );
    
    const toolMsg = chatState.getToolMessageByCallId('call_123');
    expect(toolMsg.approvalStatus).toBe('approved');
    expect(toolMsg.approvalLevel).toBe('admin');
  });
});
```

## Field Mapping (Backend ↔ Frontend)

| Backend (snake_case) | Frontend (camelCase) |
|---------------------|---------------------|
| tool_call_id | toolCallId |
| tool_name | toolName |
| tool_input | toolInput |
| message | message (same) |
| risk_level | riskLevel |
| affected_resources | affectedResources |
| reversible | reversible (same) |
| estimated_impact | estimatedImpact |
| similar_operations_count | similarOperationsCount |
| available_approval_levels | availableApprovalLevels |
| default_approval_level | defaultApprovalLevel |

This mapping is handled automatically in `RestChatService.ts`.
