import type { Handler } from '@netlify/functions';
import { connectLambda } from '@netlify/blobs';
import { processMessage } from '../../src/process-message.js';
import { IS_DEMO } from '../../src/config.js';
import { seedDemoDataIfNeeded } from '../../src/demo/seed-demo-data.js';

// Support both FB_* and FACEBOOK_* env var names for convenience.
const VERIFY_TOKEN =
  process.env.FB_VERIFY_TOKEN ?? process.env.FACEBOOK_VERIFY_TOKEN ?? undefined;
const PAGE_ACCESS_TOKEN =
  process.env.FB_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? undefined;

async function sendFacebookMessage(recipientId: string, text: string): Promise<void> {
  if (!PAGE_ACCESS_TOKEN) {
    console.warn('FB_PAGE_ACCESS_TOKEN is not set; skipping send to Messenger.');
    return;
  }

  const body = {
    recipient: { id: recipientId },
    message: { text },
  };

  await fetch(
    `https://graph.facebook.com/v17.0/me/messages?access_token=${encodeURIComponent(
      PAGE_ACCESS_TOKEN,
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export const handler: Handler = async (event) => {
  // Ensure Netlify Blobs is wired up in local dev and production.
  connectLambda(event as any);

  if (IS_DEMO) {
    await seedDemoDataIfNeeded();
  }
  if (event.httpMethod === 'GET') {
    const mode = event.queryStringParameters?.['hub.mode'];
    const token = event.queryStringParameters?.['hub.verify_token'];
    const challenge = event.queryStringParameters?.['hub.challenge'];

    if (mode === 'subscribe' && token && token === VERIFY_TOKEN) {
      return {
        statusCode: 200,
        body: challenge ?? '',
      };
    }

    return {
      statusCode: 403,
      body: 'Verification failed',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  if (!event.body) {
    return { statusCode: 400, body: 'Missing body' };
  }

  const payload = JSON.parse(event.body);

  const messagingEvent = payload.entry?.[0]?.messaging?.[0];
  const senderId: string | undefined = messagingEvent?.sender?.id;
  const message = messagingEvent?.message;
  const text: string | undefined = message?.text;
  const attachments: any[] = message?.attachments ?? [];
  const timestamp: number = messagingEvent?.timestamp ?? Date.now();

  // Normalize any image attachments into a list of URLs for processMessage.
  const mediaUrls: string[] = attachments
    .filter((att) => att?.type === 'image' && att?.payload?.url)
    .map((att) => att.payload.url as string);

  // If we have neither sender nor any usable content (text or images), ignore.
  if (!senderId || (!text && mediaUrls.length === 0)) {
    return { statusCode: 200, body: 'No usable message' };
  }

  const normalizedText = text ?? '';

  const result = await processMessage({
    senderId,
    text: normalizedText,
    channel: 'messenger',
    timestamp,
    rawPayload: payload,
    mediaUrls,
  });

  await sendFacebookMessage(senderId, result.replyText);

  return {
    statusCode: 200,
    body: 'OK',
  };
};


