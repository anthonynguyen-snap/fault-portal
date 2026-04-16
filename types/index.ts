// =========================================================
// FAULT PORTAL — SHARED TYPE DEFINITIONS
// =========================================================

export type ClaimStatus =
  | 'Unsubmitted'
  | 'Claim Raised'
  | 'Acknowledged'
  | 'Credit Received'
  | 'Rejected';

export interface FaultCase {
  id: string;
  date: string;                 // ISO date string e.g. "2024-03-15"
  orderNumber: string;
  customerName: string;
  product: string;              // Product name
  manufacturerName: string;     // Auto-filled from product
  manufacturerNumber: string;   // Selected from product's preset list
  faultType: string;
  faultNotes: string;
  evidenceLink: string;         // Google Drive shareable link
  unitCostUSD: number;          // Auto-filled from product
  claimStatus: ClaimStatus;
  submittedBy: string;
  createdAt: string;            // ISO timestamp
}

export interface Product {
  id: string;
  name: string;
  manufacturerName: string;
  unitCostUSD: number;
  manufacturerNumbers: string[]; // Preset selectable options e.g. ["MN-001", "MN-002"]
}

export interface Manufacturer {
  id: string;
  name: string;
  contactEmail: string;
  phone: string;
  notes: string;
}

export interface FaultType {
  id: string;
  name: string;
  description: string;
}

export interface Claim {
  id: string;
  manufacturer: string;
  month: string;   // e.g. "March"
  year: string;    // e.g. "2024"
  faultCount: number;
  costAtRisk: number;         // Total unit cost of all faults in batch
  amountRecovered: number;    // Credit received from manufacturer
  status: ClaimStatus;
  notes: string;
  caseIds: string[];          // Array of FaultCase IDs in this claim batch
}

export interface DashboardStats {
  totalFaults: number;
  faultsThisWeek: number;
  faultsThisMonth: number;
  costLostThisWeek: number;
  costLostThisMonth: number;
  faultsByManufacturer: ManufacturerStat[];
  topFaultTypes: FaultTypeStat[];
  recentCases: FaultCase[];
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
  productFaultCounts: ProductStat[];
}

export interface ManufacturerStat {
  name: string;
  count: number;
  cost: number;
}

export interface FaultTypeStat {
  name: string;
  count: number;
}

export interface TrendPoint {
  label: string;
  count: number;
  cost: number;
}

export interface ProductStat {
  name: string;
  count: number;
  cost: number;
}

// API response wrappers
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// =========================================================
// RETURNS
// =========================================================
export type ReturnCondition =
  | 'Sealed'
  | 'Open - Good Condition'
  | 'Open - Damaged Packaging'
  | 'Faulty';

export type ReturnDecision =
  | 'Full Refund'
  | 'Exchange'
  | 'Refund + Restocking Fee'
  | 'Refund - Return Label Fee'
  | 'Replacement'
  | 'Pending';

export type ReturnStatus = 'Received' | 'Inspected' | 'Processed' | 'Closed';

export type FollowUpStatus = 'N/A' | 'Pending' | 'Completed';

export interface Return {
  id: string;
  date: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  product: string;
  condition: ReturnCondition;
  decision: ReturnDecision;
  restockingFee: number;        // 0–30 (%)
  assignedTo: string;
  followUpStatus: FollowUpStatus;
  followUpNotes: string;
  notes: string;
  status: ReturnStatus;
  processedBy: string;
  conversationLink: string;
  createdAt: string;
}
