import { getStore } from '@netlify/blobs';
import { SARA_MODE } from '../config.js';
import { DEMO_SEED_DATA } from './seed-data.js';
import type {
  DemoAreaStats,
  DemoContractorStats,
  DemoDamageReport,
  DemoProject,
} from './demo-types.js';
import {
  saveDemoDamageReport,
  saveDemoProject,
  saveDemoAreaStatsBatch,
  saveDemoContractorStatsBatch,
} from '../utils/blobs.js';

const META_STORE_NAME = 'demo_meta';
const META_SEEDED_KEY = 'seeded.json';

interface DemoMetaSeededFlag {
  seeded: boolean;
  mode: string;
  lastSeededAt: string;
}

export async function seedDemoDataIfNeeded(): Promise<void> {
  if (SARA_MODE !== 'demo') return;

  const metaStore = getStore({ name: META_STORE_NAME });
  const existing = (await metaStore.get(META_SEEDED_KEY, {
    type: 'json',
  })) as DemoMetaSeededFlag | null;

  if (existing?.seeded) {
    return;
  }

  // Write canonical demo entities to their respective stores.
  await Promise.all([
    seedDamageReports(DEMO_SEED_DATA.damageReports),
    seedProjects(DEMO_SEED_DATA.projects),
    seedAreaStats(DEMO_SEED_DATA.areaStats),
    seedContractorStats(DEMO_SEED_DATA.contractorStats),
  ]);

  const nowIso = new Date().toISOString();
  const flag: DemoMetaSeededFlag = {
    seeded: true,
    mode: SARA_MODE,
    lastSeededAt: nowIso,
  };
  await metaStore.setJSON(META_SEEDED_KEY, flag);
}

async function seedDamageReports(reports: DemoDamageReport[]): Promise<void> {
  for (const report of reports) {
    await saveDemoDamageReport(report);
  }
}

async function seedProjects(projects: DemoProject[]): Promise<void> {
  for (const project of projects) {
    await saveDemoProject(project);
  }
}

async function seedAreaStats(stats: DemoAreaStats[]): Promise<void> {
  await saveDemoAreaStatsBatch(stats);
}

async function seedContractorStats(stats: DemoContractorStats[]): Promise<void> {
  await saveDemoContractorStatsBatch(stats);
}
