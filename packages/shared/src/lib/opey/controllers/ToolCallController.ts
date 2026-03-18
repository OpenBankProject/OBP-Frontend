import type { ToolCall } from '../types';

//WIP
export interface ToolCallApprover {
    approve(call: ToolCall): Promise<void>;
    reject(call: ToolCall): void
}

export class ToolCallController {
    constructor(private approver: ToolCallApprover) { }


    // Need to implement logic to handle rejecting a call
    async handle(call: ToolCall) {
        if (call.status === 'awaiting_approval') {
            await this.approver.approve(call)
        }
    }
}