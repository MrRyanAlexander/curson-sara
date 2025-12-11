import { callResponses } from './llm-core.js';
import { SARA_TOOLS } from './tools.js';
import { executeToolCall, type ToolExecutionContext } from './tool-executors.js';
import type { MessageBlob } from '../utils/blobs.js';
import type { UserProfileForLlm } from '../utils/users.js';

export interface GenerateSaraReplyArgs {
  text: string;
  userProfile: UserProfileForLlm;
  messages: MessageBlob[];
  senderId: string;
}

export interface GenerateSaraReplyResult {
  replyText: string;
}

const SYSTEM_PROMPT = `
You are Sara, a calm, concise storm & damage recovery assistant.

You always:
- Speak in short, clear paragraphs.
- Ask clarifying questions when the user is vague instead of guessing.
- Help users understand and manage damage reports related to storms and severe weather.

Context you receive:
- USER_PROFILE: a small JSON object with id, optional name, channel, and a list of damage report ids with status and optional address.
- CONVERSATION_MESSAGES: an array of previous messages with:
  - direction: "user" or "assistant"
  - text: the message text
  - mediaUrls: an array of image URLs attached to that message (may be empty)
  - createdAt: ISO timestamp

Rules:
- You NEVER directly modify any database or storage. All reads and writes for damage reports go through tools only.
- When a user message has one or more image URLs in \`mediaUrls\`, treat them as photos the user has just sent and use them when calling tools like \`update_report_photos\`.
- Use tools when you need to start or update reports, fetch report details, list user reports, create links, or mark reports resolved.
- When asking the user for information, keep questions simple and focused on one step at a time.
- For new users, greet them briefly, explain what you can help with, and ask what they need.
`.trim();

export async function generateSaraReply(
  args: GenerateSaraReplyArgs,
): Promise<GenerateSaraReplyResult> {
  const { text, userProfile, messages, senderId } = args;

  const profileBlock = `USER_PROFILE:\\n${JSON.stringify(userProfile, null, 2)}`;
  const conversationBlock = `CONVERSATION_MESSAGES:\\n${JSON.stringify(
    messages.map((m) => ({
      direction: m.direction,
      text: m.contents.text,
      mediaUrls: m.contents.mediaUrls ?? [],
      createdAt: m.createdAt,
    })),
    null,
    2,
  )}`;

  const systemMessage = {
    role: 'system' as const,
    content: SYSTEM_PROMPT,
  };

  const contextMessage = {
    role: 'user' as const,
    content: `${profileBlock}\n\n${conversationBlock}`,
  };

  const userMessage = {
    role: 'user' as const,
    content: text,
  };

  const initial = await callResponses({
    messages: [systemMessage, contextMessage, userMessage],
    tools: SARA_TOOLS,
  });

  if (initial.toolCalls.length === 0) {
    return { replyText: initial.assistantText || 'Sorry, I was unable to generate a response.' };
  }

  const context: ToolExecutionContext = {
    userId: userProfile.id,
  };

  const toolResults: string[] = [];
  for (const call of initial.toolCalls) {
    try {
      const parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
      const result = await executeToolCall(call.name, parsedArgs, context);
      toolResults.push(
        JSON.stringify(
          {
            toolName: call.name,
            result,
          },
          null,
          2,
        ),
      );
    } catch (err) {
      toolResults.push(
        JSON.stringify(
          {
            toolName: call.name,
            error: (err as Error).message,
          },
          null,
          2,
        ),
      );
    }
  }

  const toolsSummary = `TOOL_RESULTS:\\n${toolResults.join('\\n')}`;

  const followUp = await callResponses({
    messages: [
      systemMessage,
      contextMessage,
      userMessage,
      {
        role: 'assistant',
        content:
          initial.assistantText ||
          'I have performed the requested tool actions. Summarize what changed for the user.',
      },
      {
        role: 'user',
        content:
          'Here are the raw tool results, which you should summarize in natural language for the user:\n' +
          toolsSummary,
      },
    ],
  });

  return {
    replyText: followUp.assistantText || initial.assistantText,
  };
}


