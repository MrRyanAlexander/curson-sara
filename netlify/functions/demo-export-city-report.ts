import type { Handler } from '@netlify/functions';
import { connectLambda } from '@netlify/blobs';
import { IS_DEMO } from '../../src/config.js';
import { seedDemoDataIfNeeded } from '../../src/demo/seed-demo-data.js';
import { getDemoSessionToken, listAllDemoDamageReports } from '../../src/utils/blobs.js';

export const handler: Handler = async (event) => {
  connectLambda(event as any);

  if (!IS_DEMO) {
    return {
      statusCode: 400,
      body: 'Demo export is only available in demo mode',
    };
  }

  await seedDemoDataIfNeeded();

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  const token = event.queryStringParameters?.token;
  if (!token) {
    return {
      statusCode: 400,
      body: 'token is required',
    };
  }

  const session = await getDemoSessionToken(token);
  if (!session) {
    return {
      statusCode: 404,
      body: 'Session not found',
    };
  }

  if (session.role !== 'city') {
    return {
      statusCode: 403,
      body: 'Only the city demo role can export aggregated reports',
    };
  }

  const now = new Date();
  if (new Date(session.expiresAt).getTime() <= now.getTime()) {
    return {
      statusCode: 410,
      body: 'Demo session expired',
    };
  }

  const reports = await listAllDemoDamageReports();

  const header = [
    'report_id',
    'resident_name',
    'address',
    'damage_type',
    'status',
    'assigned_contractor_id',
  ];

  const rows = reports.map((r) => [
    r.id,
    r.residentName,
    r.address,
    r.damageType,
    r.status,
    r.assignedContractorId ?? '',
  ]);

  const csvLines = [
    '# DEMO ONLY: Fictional data for Hurricane Santa in Saraville',
    header.join(','),
    ...rows.map((row) => row.map((cell) => JSON.stringify(cell)).join(',')),
  ];

  const csv = csvLines.join('\n');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="demo-city-export.csv"',
    },
    body: csv,
  };
};
