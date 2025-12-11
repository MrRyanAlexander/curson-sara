import crypto from 'node:crypto';
import { generateSaraReply } from './llm/generateSaraReply.js';
import {
  type Channel,
  type MessageBlob,
  appendMessagesForUser,
  getMessagesForUser,
} from './utils/blobs.js';
import { getOrCreateUser, toLlmUserProfile } from './utils/users.js';

export interface IncomingMessage {
  senderId: string;
  text: string;
  channel: Channel;
  timestamp: number;
  rawPayload: unknown;
  nameHint?: string;
}

export interface ProcessMessageResult {
  replyText: string;
}

export async function processMessage(incoming: IncomingMessage): Promise<ProcessMessageResult> {
  const { senderId, text, channel, timestamp, rawPayload, nameHint } = incoming;

  const user = await getOrCreateUser(channel, senderId, nameHint);
  const history = await getMessagesForUser(user.id);
  const userProfileForLlm = toLlmUserProfile(user);

  const reply = await generateSaraReply({
    text,
    userProfile: userProfileForLlm,
    messages: history,
    senderId,
  });

  const createdAtIso = new Date(timestamp || Date.now()).toISOString();

  const newMessages: MessageBlob[] = [
    {
      id: crypto.randomUUID(),
      userId: user.id,
      direction: 'user',
      contents: { text },
      createdAt: createdAtIso,
    },
    {
      id: crypto.randomUUID(),
      userId: user.id,
      direction: 'assistant',
      contents: { text: reply.replyText },
      createdAt: new Date().toISOString(),
    },
  ];

  await appendMessagesForUser(user.id, newMessages);

  // rawPayload is currently unused but reserved for future logging/analytics.
  void rawPayload;

  return { replyText: reply.replyText };
}


