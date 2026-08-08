export type UserRole = "REGISTER" | "ADMIN";

export type AssetType = "GENERAL" | "IT" | "MEDICAL";

export type AssetStatus = "IN_USE" | "IN_STOCK" | "REPAIR" | "DISPOSED";

export type QrStatus = "unused" | "assigned" | "retired";

export type ImportJobStatus =
  | "uploaded"
  | "validated"
  | "committed"
  | "failed"
  | "expired";

export type ImportRowStatus = "pending" | "valid" | "error" | "imported";

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  asset_no: string;
  name: string;
  asset_type: AssetType;
  category: string;
  status: AssetStatus;
  serial_no: string | null;
  manufacturer: string | null;
  model_name: string | null;
  location: string | null;
  department: string | null;
  assignee_name: string | null;
  notes: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  qr_code_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QrCode {
  id: string;
  token: string;
  display_code: string;
  status: QrStatus;
  asset_id: string | null;
  batch_id: string | null;
  created_by: string | null;
  created_at: string;
  assigned_at: string | null;
}

export interface QrBatch {
  id: string;
  quantity: number;
  label_format: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DashboardStats {
  total: number;
  general_count: number;
  it_count: number;
  medical_count: number;
  in_use_count: number;
  repair_count: number;
  unlinked_qr_count: number;
  by_type: { key: string; count: number }[];
  by_status: { key: string; count: number }[];
  by_location: { key: string; count: number }[];
  by_qr_link: { key: string; count: number }[];
  daily_created: { date: string; count: number }[];
  recent: Asset[];
}

export interface AssignQrResult {
  ok: boolean;
  error?: string;
  detail?: string;
  asset_id?: string;
  existing_asset_id?: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface PurchaseHistory {
  id: string;
  item_name: string;
  purchase_date: string;
  department: string;
  /** Omitted on list/stats selects to reduce unnecessary PII exposure. */
  user_id?: string;
  created_at: string;
  updated_at?: string;
}
