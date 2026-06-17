export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type UserPlan = 'free' | 'pro' | 'growth' | 'agency' | 'owner';

export interface HeaderChecks {
  csp: boolean;
  hsts: boolean;
  xFrame: boolean;
  xContentType: boolean;
  referrerPolicy: boolean;
  permissionsPolicy: boolean;
}

export interface Profile {
  id: string;
  email: string;
  plan: UserPlan;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
}

export type ScanScheduleMode = 'daily_scan' | 'weekly_deep_scan' | 'hourly_monitor';

export interface Website {
  id: string;
  user_id: string;
  url: string;
  label: string | null;
  risk_score: number | null;
  last_scanned_at: string | null;
  next_scan_at: string | null;
  scan_frequency: ScanScheduleMode | null;
  created_at: string;
  /** Monitoring enabled — cron enqueues when next_scan_at is due. */
  is_active: boolean;
  /** Agency/owner: 5-minute monitoring when true; hourly when false. */
  priority_monitoring: boolean;
}

export interface Scan {
  id: string;
  user_id: string;
  website_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  security_score: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  ssl_valid: boolean | null;
  headers: HeaderChecks | null;
  issues: string[] | null;
  passed: string[] | null;
  explanation: string | null;
  findings: string[] | null;
  breakdown: string[] | null;
  recommendations: string[] | null;
  vulnerabilities_count: number | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  websites?: { url: string; label: string | null };
}

export interface Alert {
  id: string;
  user_id: string;
  website_id: string | null;
  scan_id: string | null;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  is_read: boolean;
  resolved: boolean;
  type: string;
  created_at: string;
}

export interface DashboardStats {
  websiteCount: number;
  latestScore: number | null;
  activeAlertCount: number;
  lastScanAt: string | null;
  recentScans: RecentScan[];
  securityOverview: SecurityOverviewItem[];
}

export interface RecentScan {
  id: string;
  website_url: string;
  website_label: string | null;
  security_score: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  status: string;
  completed_at: string | null;
  started_at: string;
  explanation: string | null;
}

export interface SecurityOverviewItem {
  label: string;
  key: string;
  pass: number;
  fail: number;
  total: number;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

export type AuthError = {
  message: string;
};
