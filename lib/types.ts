export interface FaultEntry {
  id: string;
  submittedAt: string;
  faultDate: string;
  orderNumber: string;
  customerName: string;
  productName: string;
  manufacturer: string;
  faultType: string;
  description: string;
  internalCost: string;
  staffMember: string;
  status: string;
  evidenceUrls: string[];
  driveFolderUrl: string;
}

export type NewFaultPayload = Omit<FaultEntry, "id" | "submittedAt" | "status">;

export const FAULT_TYPES = [
  "Physical Damage",
  "Not Working / Dead on Arrival",
  "Missing Parts",
  "Cosmetic Defect",
  "Incorrect Item Sent",
  "Water / Liquid Damage",
  "Other",
] as const;

export const STATUS_OPTIONS = ["Open", "In Progress", "Resolved"] as const;

export const SHEET_COLUMNS = [
  "fault_id",
  "submitted_at",
  "fault_date",
  "order_number",
  "customer_name",
  "product_name",
  "manufacturer",
  "fault_type",
  "description",
  "internal_cost",
  "staff_member",
  "status",
  "evidence_urls",
  "drive_folder_url",
] as const;
