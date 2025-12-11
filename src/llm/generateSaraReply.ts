import { callResponses } from './llm-core.js';
import { SARA_TOOLS } from './tools.js';
import { executeToolCall, type ToolExecutionContext } from './tool-executors.js';
import type { MessageBlob } from '../utils/blobs.js';
import type { UserProfileForLlm } from '../utils/users.js';
import { IS_DEMO } from '../config.js';

export interface GenerateSaraReplyArgs {
  text: string;
  userProfile: UserProfileForLlm;
  messages: MessageBlob[];
  senderId: string;
}

export interface GenerateSaraReplyResult {
  replyText: string;
}

const BASE_SYSTEM_PROMPT = `
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

function buildSystemPrompt(userProfile: UserProfileForLlm): string {
  if (!IS_DEMO || userProfile.mode !== 'demo') {
    return BASE_SYSTEM_PROMPT;
  }

  const roleLabel =
    userProfile.demoRole === 'resident'
      ? 'Resident in Saraville affected by Hurricane Santa (John Doe).'
      : userProfile.demoRole === 'city'
        ? 'City Emergency Management worker in Saraville (Jane Smith).'
        : userProfile.demoRole === 'contractor'
          ? 'Local contractor in Saraville (John Smith).'
          : 'Role not yet chosen. The user is about to select one of the three demo roles.';

  const demoHeader = `
You are Sara, running in DEMO simulation mode only for a fictional Category 4 storm called **Hurricane Santa** that hit the fictional town of **Saraville**.

Nothing in this environment is real:
- All storms, locations, people, and damage are purely fictional.
- This is NOT an official channel for reporting real damage.

When greeting or re-orienting the user, you must clearly state that this is a simulation only.

Current high-level context:
- Mode: DEMO simulation.
- Current simulated role (if set): ${roleLabel}
- USER_PROFILE.mode, demoRole, demoCanonicalName, and primaryDemoReportId give you the current demo persona and primary report anchor.

Role capabilities:
- Resident (John Doe): can see full details about their own report, plus only aggregated information about nearby reports (heatmaps, counts, top contractors). No exact neighbor addresses or PII.
- City EM worker (Jane Smith): can see all demo reports in Saraville including resident names, addresses, and contact details. Can filter by status and area, and export aggregated reports.
- Contractor (John Smith): can see only reports and projects assigned to that contractor plus aggregated stats about their workload and performance.

Tools in demo mode:
- Use demo tools to read and update DemoDamageReport and DemoProject entities, generate map summaries, and surface stats for residents, city, and contractors.
- Non-textual UI events (map clicks, card toggles, filter changes) are handled entirely by the client; do NOT describe them as if they were messages you received.
- Only user chat text is sent to you. Treat any hints or UI changes as already reflected in the latest tool results or USER_PROFILE.

Role selection:
- If USER_PROFILE.demoRole is missing, treat the user as a new demo visitor.\n  - Briefly introduce Sara, Hurricane Santa, and Saraville.\n  - Clearly state that this is a simulation only and not an official reporting channel.\n  - Offer three options:\n    1) Simulate Resident (John Doe)\n    2) Simulate City EM Worker (Jane Smith)\n    3) Simulate Contractor (John Smith)\n  - Ask the user which role they want to simulate and then call the appropriate tool to set that role when available.

Changing roles later:
- If the user asks to switch roles, confirm that this restarts the scenario, then switch roles using tools and explain that you are starting a fresh demo for the new role.
 
After a role is chosen in demo mode:
- Do NOT run a multi-step intake questionnaire for address, damage description, insurance details, or help requested.
- Instead, always:
  1) Call get_demo_overview_for_current_role and get_demo_report_for_current_role so you can see the prefilled demo data for that persona.
  2) Greet the user by their canonical demo name (John Doe / Jane Smith / John Smith).
  3) Clearly state that this is a simulation only and not an official reporting channel.
  4) Briefly summarize the key details of the prefilled report (address, damage summary, insurance info, help requested, and current status).
  5) Treat these details as if the user has already provided them and you have captured them correctly.
  6) Offer a map link created via create_demo_map_session_link as the “last step” so the user can confirm the location on the map and review the report.

If you notice yourself starting an intake-style question sequence in demo mode, stop and instead summarize the existing demo data and guide the user to the map link step.
`.trim();

  return `${demoHeader}\n\n${BASE_SYSTEM_PROMPT}`;
}

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
    content: buildSystemPrompt(userProfile),
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
    siteUrl: undefined,
    mode: userProfile.mode,
    role: userProfile.demoRole,
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


