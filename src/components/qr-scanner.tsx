"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const READER_ID = "qr-reader";

/** Extract /q/{token} token from full URL or raw UUID. */
export function extractQrToken(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const u = new URL(text);
    const m = u.pathname.match(/\/q\/([0-9a-fA-F-]{36})/);
    if (m) return m[1];
  } catch {
    // not a URL
  }
  const pathMatch = text.match(/\/q\/([0-9a-fA-F-]{36})/);
  if (pathMatch) return pathMatch[1];
  if (/^[0-9a-fA-F-]{36}$/.test(text)) return text;
  return null;
}

export function QrScanner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  function goToToken(token: string) {
    if (handledRef.current) return;
    handledRef.current = true;
    router.push(`/q/${token}`);
  }

  async function start() {
    setError(null);
    handledRef.current = false;
    try {
      const scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          const token = extractQrToken(decoded);
          if (token) {
            void scanner.stop().catch(() => undefined);
            goToToken(token);
          } else {
            setError("지원하는 QR 형식이 아닙니다. (/q/{token})");
          }
        },
        () => undefined
      );
      setScanning(true);
    } catch (e) {
      console.error("[QrScanner]", e);
      setError(
        "카메라를 시작할 수 없습니다. HTTPS·권한을 확인하거나 아래에 코드를 입력하세요."
      );
      setScanning(false);
    }
  }

  async function stop() {
    const scanner = scannerRef.current;
    if (scanner?.isScanning) {
      try {
        await scanner.stop();
      } catch {
        /* ignore */
      }
    }
    scannerRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      void stop();
    };
  }, []);

  function onManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = extractQrToken(manual);
    if (!token) {
      setError("유효한 QR URL 또는 토큰(UUID)을 입력하세요.");
      return;
    }
    goToToken(token);
  }

  return (
    <div className="space-y-4" data-testid="qr-scanner">
      <div
        id={READER_ID}
        className="overflow-hidden rounded-xl bg-black/5 ring-1 ring-foreground/10"
      />
      <div className="flex flex-wrap gap-2">
        {!scanning ? (
          <Button type="button" onClick={() => void start()} data-testid="scan-start">
            카메라 스캔 시작
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => void stop()}>
            스캔 중지
          </Button>
        )}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <form onSubmit={onManualSubmit} className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <Label htmlFor="manual-token">수동 입력 (URL 또는 토큰)</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="manual-token"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="https://…/q/uuid 또는 uuid"
            className="max-w-md"
          />
          <Button type="submit" variant="outline">
            이동
          </Button>
        </div>
      </form>
    </div>
  );
}
