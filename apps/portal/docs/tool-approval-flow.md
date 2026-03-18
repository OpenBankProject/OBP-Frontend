# Tool Approval Flow

## Overview

The tool approval system allows users to review and approve/deny certain tool executions before they run. This is critical for operations that might modify data, cost money, or have other side effects.

## Architecture

### Components

1. **ChatService** (`RestChatService.ts`)
   - Handles low-level communication with the backend
   - Sends approval decisions via `sendApproval(toolCallId, approved, threadId)`
   - Receives `approval_request` events from the backend

2. **ChatController** (`ChatController.ts`)
   - Business logic layer
   - Exposes high-level methods: `approveToolCall()` and `denyToolCall()`
   - Handles optimistic UI updates and error recovery
   - Coordinates between ChatService and ChatState

3. **ChatState** (`ChatState.ts`)
   - State management
   - Tracks tool messages with approval status
   - Methods: `addApprovalRequest()`, `updateApprovalRequest()`, `removeApprovalRequest()`

4. **UI Components** (`OpeyChat.svelte`, `ChatMessage.svelte`)
   - Display approval requests to users
   - Render approve/deny buttons
   - Show approval status (approved, denied, waiting)

## Flow Diagram

```
Backend                ChatService              ChatController            ChatState                UI
   |                       |                         |                       |                      |
   |--approval_request---->|                         |                       |                      |
   |                       |----onStreamEvent------->|                       |                      |
   |                       |                         |--addApprovalRequest-->|                      |
   |                       |                         |                       |----emit------------->|
   |                       |                         |                       |                      |
   |                       |                         |                       |           [User sees request]
   |                       |                         |                       |                      |
   |                       |                         |<------approveToolCall(toolCallId)------------|
   |                       |                         |--updateToolMessage--->|                      |
   |                       |                         |   (optimistic update) |----emit------------->|
   |                       |<---sendApproval---------|                       |                      |
   |<---POST /approval-----|                         |                       |           [Shows "approved"]
   |                       |                         |                       |                      |
   |---tool_start--------->|----onStreamEvent------->|                       |                      |
   |                       |                         |--removeApprovalReq--->|                      |
   |                       |                         |--updateToolMessage--->|                      |
   |                       |                         |   (isStreaming=true)  |----emit------------->|
   |                       |                         |                       |           [Shows execution]
   |                       |                         |                       |                      |
   |---tool_complete------>|----onStreamEvent------->|                       |                      |
   |                       |                         |--updateToolMessage--->|                      |
   |                       |                         |                       |----emit------------->|
   |                       |                         |                       |           [Shows result]
```

## State Lifecycle

### ToolMessage States

A `ToolMessage` goes through these states:

1. **Approval Request**
   ```typescript
   {
     waitingForApproval: true,
     approvalStatus: undefined,
     isStreaming: false
   }
   ```

2. **User Approved** (optimistic)
   ```typescript
   {
     waitingForApproval: false,
     approvalStatus: 'approved',
     isStreaming: false
   }
   ```

3. **Tool Executing** (after backend confirms)
   ```typescript
   {
     waitingForApproval: false,
     approvalStatus: 'approved',
     isStreaming: true
   }
   ```

4. **Tool Completed**
   ```typescript
   {
     waitingForApproval: false,
     approvalStatus: 'approved',
     isStreaming: false,
     status: 'success' | 'error',
     toolOutput: {...}
   }
   ```

5. **User Denied**
   ```typescript
   {
     waitingForApproval: false,
     approvalStatus: 'denied',
     isStreaming: false,
     status: 'error',
     toolOutput: 'Tool execution was denied by user'
   }
   ```

## Implementation Guide

### Backend Integration

Your backend should send an `approval_request` event when a tool needs approval:

```json
{
  "type": "approval_request",
  "tool_call_id": "call_abc123",
  "tool_name": "delete_customer",
  "tool_input": {"customer_id": "12345"},
  "message": "Delete customer John Doe (ID: 12345)",
  "risk_level": "high",
  "reversible": false,
  "affected_resources": ["customer:12345", "orders:67890"],
  "estimated_impact": "This will permanently delete the customer and all associated orders",
  "similar_operations_count": 3,
  "available_approval_levels": ["user", "admin", "super_admin"],
  "default_approval_level": "admin"
}
```

**Note:** Use snake_case for field names in the event (e.g., `risk_level`, `tool_call_id`). The frontend will automatically convert them to camelCase.

When receiving approval/denial from the frontend:

```
POST /approval/{thread_id}
{
  "tool_call_id": "call_abc123",
  "approval": "approve" | "deny",
  "approval_level": "user" | "admin" | "super_admin"  // optional
}
```

Then send either:
- `tool_start` event (if approved)
- Or simply close the request (if denied)

### Frontend Usage

#### In UI Components

**Simple Version:**
```svelte
<script>
  import { ChatController } from '$lib/opey/controllers/ChatController';
  
  let chatController: ChatController;
  
  async function handleApprove(toolCallId: string) {
    try {
      await chatController.approveToolCall(toolCallId);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  }
  
  async function handleDeny(toolCallId: string) {
    try {
      await chatController.denyToolCall(toolCallId);
    } catch (error) {
      console.error('Failed to deny:', error);
    }
  }
</script>

{#if message.role === 'tool' && message.waitingForApproval}
  <div class="approval-request">
    <p>{message.approvalMessage}</p>
    
    {#if message.riskLevel}
      <span class="risk-badge risk-{message.riskLevel}">
        {message.riskLevel.toUpperCase()} RISK
      </span>
    {/if}
    
    <div class="approval-buttons">
      <button on:click={() => handleApprove(message.toolCallId)}>
        Approve
      </button>
      <button on:click={() => handleDeny(message.toolCallId)}>
        Deny
      </button>
    </div>
  </div>
{/if}
```

**Full-Featured Version with Approval Levels:**
```svelte
<!-- Use the pre-built ToolApprovalCard component -->
<script>
  import ToolApprovalCard from '$lib/components/ToolApprovalCard.svelte';
  import { ChatController } from '$lib/opey/controllers/ChatController';
  
  let chatController: ChatController;
  
  async function handleApprove(toolCallId: string, approvalLevel?: string) {
    await chatController.approveToolCall(toolCallId, approvalLevel);
  }
  
  async function handleDeny(toolCallId: string) {
    await chatController.denyToolCall(toolCallId);
  }
</script>

{#if message.role === 'tool' && message.waitingForApproval}
  <ToolApprovalCard 
    toolMessage={message} 
    onApprove={handleApprove}
    onDeny={handleDeny}
  />
{/if}
```

The `ToolApprovalCard` component displays:
- Risk level with color coding
- Approval message
- Affected resources
- Reversibility indicator
- Estimated impact
- Similar operations count
- Tool parameters (collapsible)
- Approval level selector (if multiple levels available)
- Approve/Deny buttons with loading states

## Best Practices

### ✅ DO

1. **Use optimistic updates** - Update UI immediately when user clicks approve/deny
2. **Handle errors gracefully** - Revert optimistic updates if network request fails
3. **Show clear descriptions** - Use the `description` field to explain what will happen
4. **Display risk information** - Show `riskLevel`, `reversible`, etc. to help user decide
5. **Disable buttons during processing** - Prevent double-clicks
6. **Use consistent IDs** - Always use `toolCallId` to reference tool messages

### ❌ DON'T

1. **Don't mix `message.id` and `toolCallId`** - Always use `toolCallId` for tool operations
2. **Don't forget error handling** - Network requests can fail
3. **Don't auto-approve** - Always require explicit user action for approval requests
4. **Don't lose approval state** - Keep `approvalStatus` even after `waitingForApproval` is cleared
5. **Don't block UI** - Use async/await properly to keep UI responsive

## Timeout Handling (Future Enhancement)

Consider adding timeout logic:

```typescript
// In ChatState.ts
private approvalTimeouts = new Map<string, NodeJS.Timeout>();

addApprovalRequest(...) {
  // ... existing code ...
  
  // Set 5-minute timeout
  const timeout = setTimeout(() => {
    this.updateToolMessage(toolCallId, {
      waitingForApproval: false,
      status: 'error',
      toolOutput: 'Approval request timed out'
    });
  }, 5 * 60 * 1000);
  
  this.approvalTimeouts.set(toolCallId, timeout);
}

updateApprovalRequest(toolCallId: string, approved: boolean) {
  // ... existing code ...
  
  // Clear timeout when user responds
  const timeout = this.approvalTimeouts.get(toolCallId);
  if (timeout) {
    clearTimeout(timeout);
    this.approvalTimeouts.delete(toolCallId);
  }
}
```

## Testing

### Unit Tests

```typescript
describe('ChatController approval flow', () => {
  it('should update state optimistically on approval', async () => {
    const controller = new ChatController(mockService, chatState);
    
    await controller.approveToolCall('call_123');
    
    const toolMessage = chatState.getToolMessageByCallId('call_123');
    expect(toolMessage.approvalStatus).toBe('approved');
    expect(toolMessage.waitingForApproval).toBe(false);
  });
  
  it('should revert on network error', async () => {
    mockService.sendApproval.mockRejectedValue(new Error('Network error'));
    
    await expect(controller.approveToolCall('call_123'))
      .rejects.toThrow();
    
    const toolMessage = chatState.getToolMessageByCallId('call_123');
    expect(toolMessage.waitingForApproval).toBe(true);
  });
});
```

### Integration Tests

```typescript
it('should complete full approval flow', async () => {
  // 1. Backend sends approval_request
  mockWebSocket.emit('approval_request', {
    tool_call_id: 'call_123',
    tool_name: 'test_tool',
    // ...
  });
  
  // 2. UI should show approval buttons
  expect(screen.getByText('Approve')).toBeVisible();
  
  // 3. User clicks approve
  await userEvent.click(screen.getByText('Approve'));
  
  // 4. Should send approval to backend
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining('/approval/'),
    expect.objectContaining({
      body: expect.stringContaining('"approval":"approve"')
    })
  );
  
  // 5. Backend sends tool_start
  mockWebSocket.emit('tool_start', {
    tool_call_id: 'call_123',
    // ...
  });
  
  // 6. UI should show execution state
  expect(screen.getByText(/executing/i)).toBeVisible();
});
```

## Troubleshooting

### Issue: Approval buttons don't disappear after clicking

**Cause**: `waitingForApproval` is not being set to `false`

**Solution**: Ensure `updateApprovalRequest()` is called in `approveToolCall()`/`denyToolCall()`

### Issue: Tool executes before approval is sent

**Cause**: Backend is not waiting for approval

**Solution**: Backend should only send `tool_start` after receiving approval POST request

### Issue: UI shows "approved" but tool never executes

**Cause**: Backend might have rejected the approval or not sent `tool_start`

**Solution**: Add error handling in backend and send `error` event if approval fails

## Summary

The tool approval system is:
- **Simple**: Just two methods (`approveToolCall`, `denyToolCall`)
- **Integrated**: Works seamlessly with existing ChatService/ChatController/ChatState
- **Robust**: Handles errors with optimistic updates and rollback
- **Extensible**: Easy to add timeout handling, approval levels, etc.

The key is maintaining clear state transitions and using `toolCallId` consistently throughout the system.
