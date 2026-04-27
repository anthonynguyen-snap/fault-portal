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
  faultsFY: number;
  costFY: number;
  fyLabel: string;
  faultsLastWeek: number;
  costLostLastWeek: number;
  faultsLastMonth: number;
  costLostLastMonth: number;
  lastMonthLabel: string;
  faultsByManufacturer: ManufacturerStat[];
  topFaultTypes: FaultTypeStat[];
  recentCases: FaultCase[];
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
  productFaultCounts: ProductStat[];
  topProductNames: string[];
  productWeeklyTrend: Record<string, number | string>[];
  productMonthlyTrend: Record<string, number | string>[];
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

export interface ReturnItem {
  id: string;
  returnId: string;
  product: string;
  condition: ReturnCondition;
  decision: ReturnDecision;
  refundAmount: number;
  restockingFee: number;
}

export interface Return {
  id: string;
  date: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: ReturnItem[];
  totalRefundAmount: number;    // sum of all item refundAmounts
  assignedTo: string;
  followUpStatus: FollowUpStatus;
  followUpNotes: string;
  notes: string;
  status: ReturnStatus;
  processedBy: string;
  conversationLink: string;
  createdAt: string;
}

// =========================================================
// STOCK ROOM
// =========================================================
export interface StockItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  lowStockThreshold: number;
  discontinued: boolean;
  createdAt: string;
}

export interface StockMovementItem {
  id: string;
  movementId: string;
  stockItemId: string;
  stockItemName: string;
  quantity: number;
}

export interface StockMovement {
  id: string;
  type: 'in' | 'out';
  reason: string;
  notes: string;
  createdAt: string;
  items: StockMovementItem[];
}

// =========================================================
// PROMOTIONS
// =========================================================
export const PROMO_STORES = ['AU (+ Popup)', 'US', 'UK-NZ-ROW', 'All Stores'] as const;
export const PROMO_DISCOUNT_TYPES = ['% Off', '$ Off', 'Free Shipping', 'Bundle Deal', 'GWP (Gift with Purchase)', 'Other'] as const;

export type PromoStore        = typeof PROMO_STORES[number];
export type PromoDiscountType = typeof PROMO_DISCOUNT_TYPES[number];

export interface PromoRun {
  startDate: string;
  endDate: string | null;
}

export interface Promotion {
  id: string;
  name: string;
  code: string;
  platform: PromoStore | string;
  description: string;
  discountType: PromoDiscountType | string;
  discountValue: string;
  productsCovered: string;
  notes: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  isActive: boolean;
  enabled: boolean;
  previousRuns: PromoRun[];
  isMajor: boolean;
}

// =========================================================
// REFUND REQUESTS
// =========================================================
export type RefundStatus = 'Pending' | 'Processed' | 'Rejected';

export const REFUND_REASONS = [
  'Faulty Product - Refund Requested',
  'Mispack - Refund Requested',
  'Customer Return',
  'Missing Parcel',
  'Goodwill Gesture',
  'Pricing Error',
  'Discount Code',
  'Other',
] as const;

export type RefundReason = typeof REFUND_REASONS[number];

export type RefundResolution = 'Pending' | 'Cash Refund' | 'Store Credit';

export interface RefundRequest {
  id: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  reason: RefundReason | string;
  notes: string;
  shopifyLink: string;
  commsLink: string;
  submittedBy: string;
  status: RefundStatus;
  processedNotes: string;
  resolution: RefundResolution;
  createdAt: string;
  processedAt: string | null;
}

// =========================================================
// REPLENISHMENT
// =========================================================
export type ReplenishmentStatus = 'Pending' | 'Ordered' | 'Partially Dispatched' | 'Dispatched' | 'Delivered';
export type ReplenishmentStore  = 'Adelaide Popup' | 'Sydney Store';
export type ReplenishmentSource = 'Storeroom' | '3PL';

export interface ReplenishmentLineItem {
  id: string;
  requestId: string;
  stockItemId: string;
  stockItemName: string;
  sku: string;
  quantityRequested: number;
  quantityOnHand: number;    // snapshot at time of creation
  quantitySent: number;
  source: ReplenishmentSource;
  skipped: boolean;
}

export interface ReplenishmentRequest {
  id: string;
  store: ReplenishmentStore | string;
  orderNumber: string;
  requestedBy: string;
  date: string;
  status: ReplenishmentStatus;
  items: ReplenishmentLineItem[];
  trackingNumber: string;
  dispatchDate: string | null;
  notes: string;
  createdAt: string;
  // Split dispatch
  storeroomDispatched:     boolean;
  storeroomTracking:       string;
  storeroomDispatchDate:   string | null;
  tplDispatched:           boolean;
  tplTracking:             string;
  tplDispatchDate:         string | null;
}

// =========================================================
// ROSTER
// =========================================================
export type ShiftType  = 'mon-fri' | 'tue-sat' | 'sun-thu';
export type LeaveType  = 'sick' | 'makeup' | 'other';

export interface RosterAgent {
  id:         string;
  name:       string;
  colour:     string;
  shiftType:  ShiftType;
  isAdmin:    boolean;
  active:     boolean;
  createdAt:  string;
}

export interface RosterConfig {
  id:                 string;
  rotationStartDate:  string;
}

export interface RosterLeave {
  id:             string;
  agentId:        string;
  agentName?:     string;
  date:           string;
  leaveType:      LeaveType;
  notes:          string;
  hoursOwed:      number;
  hoursCompleted: number;
  createdAt:      string;
}

export interface RosterOverride {
  id:        string;
  agentId:   string;
  date:      string;
  isWorking: boolean;
  notes:     string;
  hours:     number;
  createdAt: string;
}

// =========================================================
// CORPORATE / WHOLESALE
// =========================================================
export type CorporateStatus =
  | 'Inquiry'
  | 'Quote Sent'
  | 'Quote Approved'
  | 'Details Received'
  | 'Mockup Sent'
  | 'Mockup Approved'
  | 'Sent to Supplier'
  | 'Supplier Quoted'
  | 'In Production'
  | 'Completed'
  | 'Delivered';

export type PaymentStatus = 'Unpaid' | 'Invoiced' | 'Paid' | 'Overdue';

export interface CorporateItem {
  id: string;
  orderId: string;
  product: string;
  quantity: number;
  unitPrice: number;
}

export interface CorporateOrder {
  id: string;
  createdAt: string;
  // Customer
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  billingAddress: string;
  shippingAddress: string;
  // Status
  status: CorporateStatus;
  // Dates
  inquiryDate: string;
  requestedDeliveryDate: string;
  actualDeliveryDate: string;
  quoteSentDate: string;
  quoteApprovedDate: string;
  mockupSentDate: string;
  mockupApprovedDate: string;
  orderSentDate: string;
  expectedCompletionDate: string;
  // Financials
  quoteAmount: number;
  supplierQuote: number;
  shippingCost: number;
  paymentStatus: PaymentStatus;
  // Supplier
  supplier: string;
  // Files
  logoUrl: string;
  mockupUrl: string;
  // Items & notes
  items: CorporateItem[];
  notes: string;
  // Meta
  referenceNumber: string;
  conversationLink: string;
}
