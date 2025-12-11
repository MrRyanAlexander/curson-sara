## Curson Sara – Storm & Damage Recovery Assistant

Curson Sara is a production‑ready storm & damage recovery assistant built on:

- A **single GPT‑5 Mini entrypoint** (`generateSaraReply`) using the OpenAI Responses API.
- **Netlify Functions** for HTTP transport (Messenger + web chat).
- **Netlify Blobs** for users, messages, damage reports, and time‑limited share links.

For a deep dive into the architecture, see:  
[`docs/architecture.md`](docs/architecture.md)

---

## Index

- [Overview](#overview)
- [Quickstart](#quickstart)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Messenger Integration](#messenger-integration)
- [Web Chat Widget](#web-chat-widget)
- [Deployment (Netlify)](#deployment-netlify)
- [Architecture & Data Model](#architecture--data-model)
- [Extending Sara](#extending-sara)

---

## Overview

- **Goal**: Help residents and agencies quickly capture storm / weather damage, track reports, and share them safely.
- **Core loop**:
  - Load full conversation + compact user profile + report summaries.
  - Run **one GPT‑5 Mini turn** via the Responses API.
  - Use tools to read/write damage reports and tokens in Blobs.
  - Save both user and assistant messages back to Blobs.
- **Channels**:
  - Facebook Messenger (webhook function: `messenger-webhook.ts`).
  - Embedded web chat (function: `web-chat-api.ts`, UI in `index.html`).

---

## Quickstart

### Prerequisites

- Node 20+
- Netlify CLI (`npm install -g netlify-cli`)
- OpenAI API key with access to GPT‑5 family models

### Install dependencies

```bash
npm install
```

### Create `.env`

```bash
OPENAI_API_KEY=sk-...
SARA_MODEL=gpt-5-mini        # optional, defaults to gpt-5-mini
SITE_URL=http://localhost:8888
FACEBOOK_VERIFY_TOKEN=your-verify-token
FACEBOOK_PAGE_ACCESS_TOKEN=your-page-access-token
```

> In Netlify’s UI you can use either `FACEBOOK_*` or `FB_*` names; the functions support both.

---

## Environment Variables

- **`OPENAI_API_KEY`**: OpenAI API key.
- **`SARA_MODEL`**: Optional override for the model (default `gpt-5-mini`).
- **`SITE_URL`**: Base URL for generating public share links.
- **`FACEBOOK_VERIFY_TOKEN` / `FB_VERIFY_TOKEN`**: Webhook verification token.
- **`FACEBOOK_PAGE_ACCESS_TOKEN` / `FB_PAGE_ACCESS_TOKEN`**: Token used to send replies via Facebook Graph API.

See [`docs/architecture.md`](docs/architecture.md#5-environment-configuration) for more detail.

---

## Local Development

### Start Netlify dev

```bash
npm run dev
```

Netlify will:

- Serve the static UI from `dist/` on `http://localhost:8888`.
- Mount functions under `/.netlify/functions/*`.
- Inject `.env` variables into the local environment.

### Expose Messenger webhook with ngrok

```bash
ngrok http 8888
```

Then configure your Facebook app webhook URL:

- Callback URL:  
  `https://<your-ngrok-domain>.ngrok-free.app/.netlify/functions/messenger-webhook`
- Verify token: `FACEBOOK_VERIFY_TOKEN` (or `FB_VERIFY_TOKEN`).

---

## Messenger Integration

- **Function**: `netlify/functions/messenger-webhook.ts`
- **Verification**:
  - Handles `GET` with `hub.mode`, `hub.verify_token`, `hub.challenge`.
  - Responds `200` + challenge when the verify token matches.
- **Inbound messages**:
  - Normalizes payload to `IncomingMessage`:
    - Text: `message.text` or `""`.
    - Images: `message.attachments` filtered for `type === "image"`, passed as `mediaUrls`.
  - Delegates to `processMessage` and sends back the resulting `replyText`.
- **Behavior**:
  - Conversation and damage‑report logic live in the LLM + tools layer, not in the function.

---

## Web Chat Widget

- **Static UI**: `/index.html`
  - Modern dark chat shell with a Sara avatar, transcript pane, input, and status line.
  - Stores a per‑browser `sessionId` in `localStorage`.
- **Backend function**: `netlify/functions/web-chat-api.ts`
  - Accepts `POST { sessionId, text, name? }`.
  - Returns `{ replyText }`.
- **How to use**:
  - Run `npm run dev`.
  - Open `http://localhost:8888/` in your browser.
  - Chat as a user; each browser tab is treated as a unique `web` channel user.

---

## Deployment (Netlify)

1. Push this repo to GitHub.
2. In Netlify, create a new site from Git and select this repo.
3. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
4. Set environment variables in the site’s **Environment** settings:
   - `OPENAI_API_KEY`
   - `SARA_MODEL` (optional)
   - `SITE_URL` (your Netlify URL, e.g. `https://cursonsara.netlify.app`)
   - Facebook tokens.
5. Enable **Netlify Blobs** for the site.
6. After deploy, update your Facebook app webhook URL to use the Netlify production domain instead of ngrok:
   - `https://<your-site>.netlify.app/.netlify/functions/messenger-webhook`

---

## Architecture & Data Model

For a full system‑level view (flows, Blobs layout, tools), see:

- [`docs/architecture.md`](docs/architecture.md)

Highlights:

- **Single LLM entrypoint**: `src/llm/generateSaraReply.ts`.
- **Tools as the only system access**: `src/llm/tools.ts` + `src/llm/tool-executors.ts`.
- **Data model**:
  - Users: `users/{channel}:{channelUserId}.json`
  - Messages: `messages/{userId}.json` (array of `MessageBlob`)
  - Damage reports: `damage_reports/{userId}/{reportId}.json`
  - Time‑limited tokens: `reportTokens/{reportId}/{token}.json`

---

## Extending Sara

- **Add a new tool**:
  - Define it in `src/llm/tools.ts` with a strict JSON Schema.
  - Implement it in `src/llm/tool-executors.ts`, backed by Blobs or another service.
  - Document it in the system prompt in `generateSaraReply.ts`.
- **Add a new channel**:
  - Create a new Netlify Function that normalizes to `IncomingMessage`.
  - Delegate to `processMessage` and adapt the reply for that channel.
- **Adjust the persona or flows**:
  - Edit the system prompt in `generateSaraReply.ts`.
  - Optionally tweak what is included in `USER_PROFILE` and `CONVERSATION_MESSAGES`.

