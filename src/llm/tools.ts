import type { FunctionTool, Tool } from 'openai/resources/responses/responses.mjs';

const functionTool = (tool: Omit<FunctionTool, 'type' | 'strict'>): FunctionTool => {
  const params = tool.parameters as any;

  // Ensure OpenAI's strict JSON schema requirement is met:
  // when strict=true, additionalProperties must be explicitly false.
  const patchedParams =
    params && params.type === 'object'
      ? {
          additionalProperties: false,
          ...params,
        }
      : params;

  return {
    ...tool,
    type: 'function',
    strict: true,
    parameters: patchedParams,
  };
};

export const SARA_TOOLS: Tool[] = [
  functionTool({
    name: 'start_damage_report',
    description: 'Start a new damage report for the current user.',
    parameters: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Street address for the damage location.' },
      },
      required: ['address'],
    },
  }),
  // --- Demo-mode tools ---
  functionTool({
    name: 'set_demo_role',
    description:
      'In demo mode, set the simulated role for the current user to resident, city, or contractor.',
    parameters: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: ['resident', 'city', 'contractor'],
          description: 'Which demo persona to simulate.',
        },
      },
      required: ['role'],
    },
  }),
  functionTool({
    name: 'get_demo_overview_for_current_role',
    description:
      'Return a high-level narrative overview of the current demo persona after Hurricane Santa in Saraville.',
    parameters: {
      type: 'object',
      properties: {},
    },
  }),
  functionTool({
    name: 'get_demo_report_for_current_role',
    description:
      'Fetch the primary demo damage report (and linked project if any) for the current demo role.',
    parameters: {
      type: 'object',
      properties: {},
    },
  }),
  functionTool({
    name: 'update_demo_report_fields',
    description:
      'Update editable fields on the primary demo damage report, such as address, damage type, insurance info, help requested, or notes.',
    parameters: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
        address: { type: 'string' },
        damageType: { type: 'string' },
        insuranceInfo: { type: 'string' },
        helpRequested: { type: 'string' },
        notes: { type: 'string' },
      },
      // With strict tools, OpenAI requires required to include every key.
      required: ['reportId', 'address', 'damageType', 'insuranceInfo', 'helpRequested', 'notes'],
    },
  }),
  functionTool({
    name: 'update_demo_project_status',
    description:
      'Update the status of a demo contractor project for the current contractor role (e.g., bid, in_progress, completed).',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        status: {
          type: 'string',
          enum: ['bid', 'in_progress', 'completed'],
        },
        note: {
          type: 'string',
          description: 'Optional short note about the status change.',
        },
      },
      required: ['projectId', 'status', 'note'],
    },
  }),
  functionTool({
    name: 'list_demo_reports_for_city',
    description:
      'For the city role, list demo reports filtered by status and/or a simple area query (e.g., near the high school).',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['unassigned', 'assigned', 'completed', 'any'],
        },
        areaQuery: {
          type: 'string',
          description: 'Loose description of the area (e.g., near the high school).',
        },
      },
      required: ['status', 'areaQuery'],
    },
  }),
  functionTool({
    name: 'get_demo_map_summary',
    description:
      'Return a role-aware summary for the map: aggregated stats for residents, full report details for city, or assigned jobs for contractors.',
    parameters: {
      type: 'object',
      properties: {
        viewport: {
          type: 'object',
          properties: {
            centerLat: { type: 'number' },
            centerLng: { type: 'number' },
            radiusKm: { type: 'number' },
          },
          required: ['centerLat', 'centerLng', 'radiusKm'],
          // Strict function tools require nested objects to also declare
          // additionalProperties: false.
          additionalProperties: false,
        },
        areaId: {
          type: 'string',
          description: 'Optional known area identifier if the client provides one.',
        },
      },
      required: ['viewport', 'areaId'],
    },
  }),
  functionTool({
    name: 'get_demo_stats_for_contractor',
    description:
      'Return aggregated stats for the current contractor: job counts, completed work, and positive feedback.',
    parameters: {
      type: 'object',
      properties: {
        lookbackDays: {
          type: 'number',
          description: 'Approximate time window in days (e.g., 7 for last week).',
        },
      },
      required: ['lookbackDays'],
    },
  }),
  functionTool({
    name: 'update_damage_report_section',
    description: 'Update one logical section of an existing damage report.',
    parameters: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
        address: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'completed', 'resolved'] },
        photoUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Full replacement list of photo URLs.',
        },
      },
       // With strict function tools, OpenAI requires `required` to include every key in properties.
      required: ['reportId', 'address', 'status', 'photoUrls'],
    },
  }),
  functionTool({
    name: 'get_report_details',
    description: 'Fetch details for a specific damage report.',
    parameters: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
      },
      required: ['reportId'],
    },
  }),
  functionTool({
    name: 'list_user_reports',
    description: 'List all damage reports for the current user.',
    parameters: {
      type: 'object',
      properties: {},
    },
  }),
  functionTool({
    name: 'update_report_address',
    description: 'Update the address on a specific damage report.',
    parameters: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
        address: { type: 'string' },
      },
      required: ['reportId', 'address'],
    },
  }),
  functionTool({
    name: 'update_report_photos',
    description: 'Add or replace photo URLs on a damage report.',
    parameters: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
        photoUrls: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['reportId', 'photoUrls'],
    },
  }),
  functionTool({
    name: 'delete_report',
    description:
      'Delete a pending report after the user explicitly confirms this is what they want.',
    parameters: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
      },
      required: ['reportId'],
    },
  }),
  functionTool({
    name: 'mark_report_resolved',
    description: 'Mark a report as resolved when downstream work is complete.',
    parameters: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
      },
      required: ['reportId'],
    },
  }),
  functionTool({
    name: 'create_time_limited_report_link',
    description: 'Create a time-limited link to view a specific report.',
    parameters: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
        ttlHours: {
          type: 'number',
          description: 'Time to live in hours for the link (defaults to 24 if omitted).',
        },
      },
      // Strict tools require `required` to include every key in `properties`
      required: ['reportId', 'ttlHours'],
    },
  }),
  functionTool({
    name: 'create_demo_map_session_link',
    description:
      'In demo mode, create a time-limited tokenized link to the map + chat UI for the current demo role.',
    parameters: {
      type: 'object',
      properties: {
        ttlHours: {
          type: 'number',
          description: 'Time to live in hours for the map session (defaults to 1 if omitted).',
        },
      },
      required: ['ttlHours'],
    },
  }),
];


