import type { Handler } from '@netlify/functions';
import { processMessage } from '../../src/process-message.js';

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export const handler: Handler = async (event) => {
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
      body: 'Method Not Allowed',
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

  const sessionId: string | undefined = parsed.sessionId;
  const text: string | undefined = parsed.text;
  const name: string | undefined = parsed.name;

  if (!sessionId || !text) {
    return {
      statusCode: 400,
      headers: buildCorsHeaders(),
      body: JSON.stringify({ error: 'sessionId and text are required' }),
    };
  }

  const result = await processMessage({
    senderId: sessionId,
    text,
    channel: 'web',
    timestamp: Date.now(),
    rawPayload: parsed,
    nameHint: name,
  });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      ...buildCorsHeaders(),
    },
    body: JSON.stringify({ replyText: result.replyText }),
  };
};


