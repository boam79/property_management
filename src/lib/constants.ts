import type { AssetStatus, AssetType } from "@/lib/types";

export const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "GENERAL", label: "일반 비품" },
  { value: "IT", label: "IT 자산" },
];

export const ASSET_STATUSES: { value: AssetStatus; label: string }[] = [
  { value: "IN_USE", label: "사용 중" },
  { value: "IN_STOCK", label: "재고" },
  { value: "REPAIR", label: "수리 중" },
  { value: "DISPOSED", label: "폐기" },
];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  GENERAL: "일반 비품",
  IT: "IT 자산",
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  IN_USE: "사용 중",
  IN_STOCK: "재고",
  REPAIR: "수리 중",
  DISPOSED: "폐기",
};

export const QR_STATUS_LABELS = {
  unused: "미사용",
  assigned: "연결됨",
  retired: "폐기",
} as const;

export const IMPORT_MAX_ROWS = 1000;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export const IMPORT_REQUIRED_HEADERS = [
  "자산번호",
  "자산명",
  "자산구분",
  "카테고리",
  "상태",
] as const;

export const IMPORT_OPTIONAL_HEADERS = [
  "시리얼번호",
  "제조사",
  "모델명",
  "위치",
  "사용부서",
  "사용자/담당자",
  "구매일",
  "구매금액",
  "비고",
  "QR 식별값",
] as const;

export const EXPORT_HEADERS = [
  ...IMPORT_REQUIRED_HEADERS,
  ...IMPORT_OPTIONAL_HEADERS,
] as const;

export const ASSET_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const ASSET_PHOTO_MAX_PER_ASSET = 10;
