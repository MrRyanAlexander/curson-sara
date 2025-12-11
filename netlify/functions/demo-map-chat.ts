import type { Handler } from '@netlify/functions';
import { connectLambda } from '@netlify/blobs';
import { IS_DEMO } from '../../src/config.js';
import { seedDemoDataIfNeeded } from '../../src/demo/seed-demo-data.js';
import {
  appendMessagesForUser,
  getDemoSessionToken,
  getMessagesForUser,
  getUserById,
  getUserReports,
  type MessageBlob,
} from '../../src/utils/blobs.js';
import { toLlmUserProfile } from '../../src/utils/users.js';
import { getOrCreateDemoRoleInfo } from '../../src/demo/demo-roles.js';
import { generateSaraReply } from '../../src/llm/generateSaraReply.js';
import crypto from 'node:crypto';

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export const handler: Handler = async (event) => {
  connectLambda(event as any);

  if (!IS_DEMO) {
    return {
      statusCode: 400,
      headers: buildCorsHeaders(),
      body: JSON.stringify({ error: 'Demo map chat is only available in demo mode' }),
    };
  }

  await seedDemoDataIfNeeded();

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: buildCorsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: buildCorsHeaders(),
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      headers: buildCorsHeaders(),
      body: JSON.stringify({ error: 'Missing body' }),
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: buildCorsHeaders(),
      body: JSON.stringify({ error: 'Invalid JSON' }),
    };
  }

  const token: string | undefined = parsed.token;
  const text: string | undefined = parsed.text;

  if (!token || !text) {
    return {
      statusCode: 400,
      headers: buildCorsHeaders(),
      body: JSON.stringify({ error: 'token and text are required' }),
    };
  }

  const session = await getDemoSessionToken(token);
  if (!session) {
    return {
      statusCode: 404,
      headers: buildCorsHeaders(),
      body: JSON.stringify({ error: 'Session not found' }),
    };
  }

  const now = new Date();
  if (new Date(session.expiresAt).getTime() <= now.getTime()) {
    return {
      statusCode: 410,
      headers: buildCorsHeaders(),
      body: JSON.stringify({ error: 'Demo session expired' }),
    };
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return {
      statusCode: 404,
      headers: buildCorsHeaders(),
      body: JSON.stringify({ error: 'User not found for session' }),
    };
  }

  const [history, reports, roleInfo] = await Promise.all([
    getMessagesForUser(user.id),
    getUserReports(user.id),
    getOrCreateDemoRoleInfo(user.id),
  ]);

  const userProfile = toLlmUserProfile(user, reports, roleInfo ?? undefined);

  const reply = await generateSaraReply({
    text,
    userProfile,
    messages: history,
    senderId: user.id,
  });

  const createdAtIso = new Date().toISOString();

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

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      ...buildCorsHeaders(),
    },
    body: JSON.stringify({ replyText: reply.replyText }),
  };
};
