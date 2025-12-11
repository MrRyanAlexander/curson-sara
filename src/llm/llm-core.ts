import type { Tool } from 'openai/resources/responses/responses.mjs';
import { openaiClient, SARA_MODEL } from './openai-client.js';

export interface CallResponsesArgs {
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  tools?: Tool[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface CallResponsesResult {
  assistantText: string;
  toolCalls: ToolCall[];
}

export async function callResponses({
  model,
  messages,
  tools,
}: CallResponsesArgs): Promise<CallResponsesResult> {
  const response = await openaiClient.responses.create({
    model: model ?? SARA_MODEL,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    tools,
  } as any);

  const outputItems = (response as any).output ?? [];

  let assistantText = (response as any).output_text ?? '';
  const toolCalls: ToolCall[] = [];

  for (const item of outputItems) {
    if (item.type === 'function_call') {
      const { call_id, name, arguments: args } = item;
      toolCalls.push({
        id: call_id,
        name,
        arguments: typeof args === 'string' ? args : JSON.stringify(args),
      });
    }
  }

  return { assistantText, toolCalls };
}


