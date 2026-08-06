import { QrScanner } from "@/components/qr-scanner";

export default function ScanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">QR 스캔</h1>
        <p className="text-sm text-muted-foreground">
          카메라로 라벨을 스캔하거나 URL·토큰을 입력하세요. 인식되면 자산
          등록/조회 페이지로 이동합니다.
        </p>
      </div>
      <QrScanner />
    </div>
  );
}
