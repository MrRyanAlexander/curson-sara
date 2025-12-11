## Curson Sara – Netlify App

Curson Sara is a storm & damage recovery assistant built on a single LLM entrypoint with tools and Netlify Blobs.

### Local development

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file (or set env vars in your shell) with:

```bash
OPENAI_API_KEY=sk-...
SARA_MODEL=gpt-4.1-mini # optional
SITE_URL=http://localhost:8888
FB_VERIFY_TOKEN=your-verify-token
FB_PAGE_ACCESS_TOKEN=your-page-access-token
```

3. Run Netlify dev:

```bash
npm run dev
```

4. Expose locally via ngrok for Messenger:

```bash
ngrok http 8888
```

Configure your Facebook app webhook URL as:

`https://<your-ngrok-domain>/.netlify/functions/messenger-webhook`

with verify token `FB_VERIFY_TOKEN`.

### Web chat widget

- Open `http://localhost:8888/` while `netlify dev` is running.
- The widget calls `/.netlify/functions/web-chat-api` with a per-browser session ID.

### Deployment (Netlify)

1. Push this repo to GitHub.
2. In Netlify, create a new site from Git and select this repo.
3. Set:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist` (functions live under `netlify/functions`).
4. In Netlify environment variables, configure the same keys as in `.env`.
5. Enable Netlify Blobs for the site.
6. After deploy, update your Facebook webhook URL to use the Netlify production domain instead of ngrok.


