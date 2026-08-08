/**
 * 등록 에러 메시지 매핑 스모크 (로컬, 네트워크 불필요)
 */
const ASSIGN_ERROR_MESSAGES = {
  UNAUTHORIZED: "로그인이 필요합니다.",
  INVALID_ASSET_TYPE: "자산구분이 올바르지 않습니다.",
  INVALID_STATUS: "자산 상태가 올바르지 않습니다.",
  QR_NOT_FOUND: "QR을 찾을 수 없습니다.",
  QR_RETIRED: "폐기된 QR입니다. 등록할 수 없습니다.",
  QR_ALREADY_ASSIGNED: "이미 등록된 QR입니다. 기존 자산으로 이동합니다.",
  DUPLICATE_VALUE:
    "이미 사용 중인 자산번호 또는 시리얼번호입니다. 다른 값으로 다시 시도하세요.",
};

function messageForAssignError(code, detail) {
  if (!code) return "등록에 실패했습니다.";
  if (code === "DUPLICATE_VALUE") {
    if (detail?.includes("serial")) {
      return "이미 사용 중인 시리얼번호입니다. 다른 값으로 다시 시도하세요.";
    }
    if (detail?.includes("asset_no")) {
      return "이미 사용 중인 자산번호입니다. 다른 값으로 다시 시도하세요.";
    }
    return ASSIGN_ERROR_MESSAGES.DUPLICATE_VALUE;
  }
  return (
    ASSIGN_ERROR_MESSAGES[code] ??
    "등록에 실패했습니다. 잠시 후 다시 시도하세요."
  );
}

const cases = [
  [
    "DUPLICATE_VALUE",
    'duplicate key value violates unique constraint "assets_asset_no_key"',
    "이미 사용 중인 자산번호입니다. 다른 값으로 다시 시도하세요.",
  ],
  [
    "DUPLICATE_VALUE",
    'duplicate key value violates unique constraint "assets_serial_no_key"',
    "이미 사용 중인 시리얼번호입니다. 다른 값으로 다시 시도하세요.",
  ],
  ["QR_ALREADY_ASSIGNED", null, ASSIGN_ERROR_MESSAGES.QR_ALREADY_ASSIGNED],
  ["QR_RETIRED", null, ASSIGN_ERROR_MESSAGES.QR_RETIRED],
  ["UNKNOWN_CODE", null, "등록에 실패했습니다. 잠시 후 다시 시도하세요."],
];

let failed = 0;
for (const [code, detail, expected] of cases) {
  const got = messageForAssignError(code, detail);
  const ok = got === expected;
  console.log(`${ok ? "OK" : "FAIL"} ${code}: ${got}`);
  if (!ok) {
    console.log("  expected", expected);
    failed++;
  }
}
if (failed) process.exit(1);
console.log("PASS register error messages");
