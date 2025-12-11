export type DemoRole = 'resident' | 'city' | 'contractor';

export interface DemoDamageReport {
  id: string;
  residentName: string;
  address: string;
  geo: { lat: number; lng: number };
  damageType: string;
  insuranceInfo?: string;
  helpRequested?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'resolved';
  assignedContractorId?: string;
  createdAt: string;
  updatedAt: string;
  isDemo: true;
}

export interface DemoProject {
  id: string;
  contractorId: string;
  reportId: string;
  status: 'bid' | 'in_progress' | 'completed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDemo: true;
}

export interface DemoUserRoleInfo {
  userId: string;
  role: DemoRole;
  canonicalName: 'John Doe' | 'Jane Smith' | 'John Smith';
  // Optional extras for the demo, such as default report ids or map presets.
  primaryDemoReportId?: string;
}

export interface DemoAreaStats {
  id: string;
  name: string;
  totalReports: number;
  assignedCount: number;
  inProgressCount: number;
  completedCount: number;
}

export interface DemoContractorStats {
  contractorId: string;
  contractorName: string;
  totalJobs: number;
  completedJobs: number;
  positiveFeedbackCount: number;
}
