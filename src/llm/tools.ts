import type { FunctionTool, Tool } from 'openai/resources/responses/responses.mjs';

const functionTool = (tool: Omit<FunctionTool, 'type' | 'strict'>): FunctionTool => ({
  ...tool,
  type: 'function',
  strict: true,
});

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
      required: ['reportId'],
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
      required: ['reportId'],
    },
  }),
];


