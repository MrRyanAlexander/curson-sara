## Curson Sara – New System Design

This document describes the **Curson Sara** architecture: a simplified, tool‑driven storm & damage recovery assistant built around a **single LLM entrypoint** and a clear data model. It supersedes the older multi‑prompt, intent‑router approach and removes the idea of the model auto‑generating formal damage reports.

---

## 1. Core Principles

- **One LLM entrypoint**: There is exactly one place where we call OpenAI – a `generateSaraReply`‑style function. All user messages go through this.
- **LLM sees the full story**: For every turn, we pass the **entire conversation history**, the **current user message**, and a **compact user profile** (including associated report IDs) into the context window.
- **Tools own the system state**: The LLM never directly touches the database. All reads and writes (damage reports, user state, tokens, etc.) go through **tools**, which are implemented as normal server code and exposed to GPT‑5 via the Responses API tools interface.
- **No intent router**: We do **not** maintain a separate intent classifier. GPT‑5 directly reasons over the full conversation + profile and decides how to respond, including if and when to call tools.
- **No AI "damage report" document generation**: We do **not** ask the model to create long, formal damage reports for storage. Instead, the model focuses on:
  - Conversational assistance.
  - Guiding the user through the damage‑reporting process.
  - Returning structured snippets only when we explicitly need them.
- **Simple, modular code**: Transport, domain logic, LLM integration, tools, and utilities are kept in separate, focused modules.

---

## 2. High‑Level Flow

Every user message follows a single, consistent path:

1. **Inbound message**
   - Request arrives at the API (e.g., `messenger-webhook` Netlify Function).
   - We normalize the payload into an internal `IncomingMessage` shape:
     - `senderId` (channel‑specific user identifier)
     - `text`
     - `channel`
     - `timestamp`
     - `rawPayload` (for logging/debugging)

2. **User & context loading**
   - Look up or create a `User` record based on `senderId`.
   - Fetch the **entire message history** for this user from storage (Netlify Blobs):
     - `[{ direction: 'user' | 'assistant', text, created_at }, ...]`.
   - Fetch a **compact user profile** that includes:
     - Name and basic info.
     - Any relevant report IDs and their statuses.

3. **Single LLM call (`generateSaraReply`)**
   - We call OpenAI **once** per turn via `callResponses`/`generateSaraReply`.
   - Input includes:
     - A **system prompt** that:
       - Describes who Sara is, how she should speak, and what she can help with.
       - Explains the structure of the context we are sending (messages list, profile, report IDs, etc.).
       - Explains how to use tools and when tools are required.
     - A structured **context payload** that the system prompt documents, for example:
       - `userProfile` (name, contact, known report IDs)
       - `conversationMessages` (entire history, or full history plus a summary if needed later)
     - The **current user message** as the final `input_text`.
     - **Tools** (the only way to read or write damage data).

4. **Tool calls (optional)**
   - If GPT‑5 decides it needs to look up or modify something (damage report: address, photos, etc.), it issues one or more tool calls.
   - Our code executes these tool calls (backed by the Blobs) and returns the results to the LLM, always within the same logical turn.

5. **Final reply + persistence**
   - We extract the final textual reply from the LLM output.
   - We append both the **user message** and the **assistant reply** to the user’s message history (e.g., Netlify Blobs).
   - We send the assistant’s reply back to the user over the originating channel.

This gives us a **single, predictable loop** for every message: load context → call LLM once → execute any tools → save + respond.

---

## 3. Data Model & Storage

### 3.1 Users

- **Purpose**: Represent a human user across sessions and channels.
- **Key fields** (DB‑level):
  - `id`: internal primary key.
  - `channel_id`: external ID (e.g., Facebook PSID).
  - `name`, `created_at`, `updated_at`, and any other profile metadata.
- **Profile view for the LLM**:
  - Name and basic info.
  - List of **associated damage report IDs**.

### 3.2 Messages

- **Storage**: Netlify Blobs, keyed by `user.id`.
- **Shape**:
  - `id`
  - `user_id`
  - `direction`: `'user'` or `'assistant'`
  - `contents` {text, media="img ref", etc}
  - `created_at`
- **Usage**:
  - For each turn, we fetch **all** messages for the user and pass them in a stable structure to the LLM as part of the context.
  - The structure is documented in the system prompt so GPT‑5 knows exactly how to interpret it.
  NOTE** For now this is acceptable even if it’s not massively scalable; we can later add summarization or windowing if needed.**

### 3.3 Damage Reports

- **Table**: `damage_reports`.
- **Key fields**:
  - `id`
  - `user_id` / `facebook_user_id`
  - `address`
  - `status`: e.g., `pending`, `completed`,`resolved`.
  - `photo_urls`: array of strings.
  - `latitude`, `longitude` (optional).
  - `created_at`, `updated_at`.
- **Semantics**:
  - `pending`: in progress; the user is still answering questions or editing details.
  - `completed`: logically complete from the user’s perspective (all required details filled in and confirmed).

The LLM helps manage damage reports conversationally but **never writes the rows directly** — it only requests actions via tools.

### 3.4 Time‑Limited Report Links

- **Table**: `report_tokens`.
- **Fields**:
  - `report_id`
  - `token` (secure UUID)
  - `expires_at` (24 hours after creation)
- **Purpose**:
  - Provide short‑lived, shareable links that allow the user to view their report for a limited time.
---

## 4. Conversation Behavior & Flows

The key idea is that **GPT‑5 sees the full conversation + profile on every turn** and can reason directly about what to do next.

### 4.1 New User / First Message

- System:
  - Creates a new `User` if none exists.
  - Message history is empty or minimal.
- LLM (via `generateSaraReply`):
  - Greets the user in a friendly, concise way.
  - Explains briefly what Sara can help with (storm/damage questions, reporting damages help, etc.).
  - Asks a simple question to clarify what the user needs.

### 4.2 Starting and Updating a Damage Report

The flow is conversational and guided by GPT‑5, but with a fixed **data model** in the background.

- The LLM may:
  - Ask the user if they want to start a damage report.
  - Once the user clearly agrees, ask for the **first group of required details** (e.g., name/residence type/address).
  - When that group is complete, request a tool call `start_damage_report` to create the Blob.
  - Continue asking follow‑up questions, one step at a time, updating the report via tools only.

- If the user’s response is incomplete or ambiguous:
  - GPT‑5 simply **asks for clarification** in plain language.
  - No Blob changes are made until the tool calls are explicitly requested and executed.

- Updates to existing reports (address correction, photo changes, etc.) are handled the same way:
  - LLM recognizes the requested change from the conversation and calls the appropriate tool.
  - Tools perform the actual update and return structured results that the LLM can describe back to the user.

### 4.3 Returning Users & Existing Reports

When a user with existing reports messages again:

- System supplies the LLM with:
  - Full message history.
  - User profile including **report IDs and statuses**.
- GPT‑5 can then:
  - Recognize references like “the report we did the other day”, “my house report”, or addresses.
  - Decide whether it needs to call a tool (e.g., a `get_report_details` or `list_user_reports`‑style tool) to fetch up‑to‑date information.
  - Respond conversationally, optionally confirming which report they mean if there are multiple matches.

### 4.4 Structured Outputs (When Needed)

Occasionally we may need the model to return **some structured data** in addition to conversational text (for example, a short JSON object describing which report the user is talking about or a particular field they want to update).

- In that case:
  - The system prompt clearly states the expected structure and where it should appear.
  - `generateSaraReply` simply parses that structured part alongside the natural‑language reply.
  - Tools still do the actual writes; the structure only instructs *what* to change.

The important point is that this is done **inline** as part of the main LLM call, not via a separate intent or classification step.

---

## 5. LLM Integration & Single Entry Point

### 5.1 OpenAI Client & Core Wrapper

- **`openai-client.mjs`**
  - Initializes the OpenAI client using `OPENAI_API_KEY`.
  - Exports `openaiClient` and the default model (e.g., `gpt-5-mini`).

- **`llm-core.mjs`**
  - Provides a single low‑level function `callResponses({ model, input, tools, ... })` that wraps the OpenAI Responses API.
  - Handles:
    - Sending the request.
    - Extracting the assistant’s text.
    - Extracting any requested tool calls.
    - Logging and error reporting.

### 5.2 Domain‑Level Helper: `generateSaraReply`

- Exposes **one** main high‑level function: `generateSaraReply({ text, userProfile, messages, senderId })`.
- Responsibilities:
  1. Build a **single system prompt** that:
     - Defines Sara’s personality, tone, and mission.
      - Explains that it will always receive the full message history and a small profile that contains the users name, id and a list of damage report id's IF any exist.
     - Documents the structure of `messages` and `userProfile`.
     - Explains the available tools and when each must be used.
  2. Construct the `input` payload for `callResponses`:
      - System role: the system prompt.
     - User role: the current message, plus inclusion/embedding of the messages/profile context (as text or as a structured block, depending on how we format it).
     - Attach `SARA_TOOLS` so GPT‑5 can call tools when needed.
  3. Call `callResponses` and get back:
      - The assistant’s text reply.
     - Any requested tool calls.
  4. If tool calls are present and `senderId` is available:
     - Execute them via `executeToolCall`.
      - Optionally make a **follow‑up** LLM call with the tool results so Sara can explain what happened in natural language.
  5. Return the final reply text (and any structured output we decide to parse).

---

## 6. Tools & Utilities

### 6.1 Tools as the Only System Access

- **`tools.mjs`**
  - Defines the list of tools (`SARA_TOOLS`) exposed to GPT‑5, using the OpenAI Responses API schema.

- **`tool-executors.mjs`**
  - Implements `executeToolCall(toolName, args, context)` which:
    - Switches on `toolName`.
    - Calls the corresponding Blob helpers using and environment configuration.
    - Returns a structured result for the LLM.

Tools include things like:

- `get_report_details` – fetch the most recent/specified report.
- `update_report_photos` – add or remove photo URLs.
- `update_report_address` – update the report address.
- `delete_report` – delete a pending report after explicit confirmation.
- `mark_report_resolved` – mark a report as resolved.
- `start_damage_report` / `update_damage_report_section` – to create and update damage reports strictly via tools.

In this architecture, **no other code path is allowed to modify report data** except these tools.

### 6.2 Time‑Limited Links & Shared Utilities

- `utils/report-links.mjs`
  - `createTimeLimitedReportLink({ reportId, ttlHours = 24 })`
  - Internal steps:
    - Generate a secure random token.
    - Insert `(report_id, token, expires_at)` into `report_tokens`.
    - Return the full URL using `SITE_URL`.

Other utilities:

- `utils/messages.mjs` – get/store user message history.
- `utils/users.mjs` – get or create user by channel ID and hydrate a small profile.

These utilities help keep the Netlify Functions and domain logic clean and focused.

---

## 7. Netlify Functions & Module Boundaries

- **`messenger-webhook.mjs`**
  - HTTP entrypoint for incoming channel events.
  - Normalizes incoming data and delegates to the core message‑processing function.

- **`process-message.mjs`**
  - Orchestrator for a single message turn:
    1. Normalize `IncomingMessage`.
    2. Load or create user.
    3. Load full message history + user profile.
    4. Call `generateSaraReply`.
    5. Persist the new user and assistant messages.
    6. Send the reply back via the appropriate channel.

---

## 8. Summary

Curson Sara is built around a **single, powerful LLM turn** per message, where GPT‑5 sees the entire conversation, a compact user profile, and clear documentation of available tools. Tools manipulate damage data, and Sara explains what’s happening in natural language. This keeps the system simple, modular, and how modern LLMs are meant to be used: reasoning over rich context and calling tools when they truly need to change or retrieve structured data.
