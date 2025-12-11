import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  // Netlify will inject env vars at runtime; fail fast if missing in this environment.
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Default model for Sara; can be overridden per-call if needed.
// Use GPT-5 Mini by default, unless explicitly overridden via SARA_MODEL.
export const SARA_MODEL = process.env.SARA_MODEL ?? 'gpt-5-mini';


