import { describe, it, expect, vi } from 'vitest';
import { generateSaraReply } from './generateSaraReply.js';
import * as llmCore from './llm-core.js';

vi.mock('./llm-core.js');

describe('generateSaraReply', () => {
  it('returns assistant text when no tool calls are present', async () => {
    vi.mocked(llmCore.callResponses).mockResolvedValueOnce({
      assistantText: 'Hello from Sara',
      toolCalls: [],
    });

    const result = await generateSaraReply({
      text: 'Hi',
      userProfile: {
        id: 'user-1',
        channel: 'web',
        reportIdsWithStatus: [],
      },
      messages: [],
      senderId: 'sender-1',
    });

    expect(result.replyText).toBe('Hello from Sara');
  });
});


