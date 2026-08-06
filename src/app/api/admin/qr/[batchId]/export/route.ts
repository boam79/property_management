import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { qrPageUrl } from "@/lib/qr-url";
import type { QrCode } from "@/lib/types";

type Format = "svg" | "png" | "pdf-a4" | "pdf-label";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const current = await getCurrentProfile();
  if (!current || current.profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { batchId } = await params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "png") as Format;

  if (!["svg", "png", "pdf-a4", "pdf-label"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qr_codes")
    .select("*")
    .eq("batch_id", batchId)
    .order("display_code", { ascending: true });

  if (error) {
    console.error("[qr export]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const codes = (data ?? []) as QrCode[];
  if (codes.length === 0) {
    return NextResponse.json({ error: "Empty batch" }, { status: 404 });
  }

  if (format === "svg") {
    const parts: string[] = [];
    for (const code of codes) {
      const svg = await QRCode.toString(qrPageUrl(code.token), {
        type: "svg",
        margin: 1,
        width: 256,
      });
      parts.push(`<!-- ${code.display_code} -->\n${svg}`);
    }
    return new NextResponse(parts.join("\n"), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="qr-${batchId}.svg"`,
      },
    });
  }

  if (format === "png") {
    if (codes.length === 1) {
      const buf = await QRCode.toBuffer(qrPageUrl(codes[0].token), {
        type: "png",
        margin: 2,
        width: 512,
      });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${codes[0].display_code}.png"`,
        },
      });
    }

    const files: { name: string; data: Buffer }[] = [];
    for (const code of codes) {
      const buf = await QRCode.toBuffer(qrPageUrl(code.token), {
        type: "png",
        margin: 2,
        width: 512,
      });
      files.push({ name: `${code.display_code}.png`, data: buf });
    }
    const zip = buildZip(files);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="qr-${batchId}.zip"`,
      },
    });
  }

  if (format === "pdf-a4") {
    const pdf = await buildA4Pdf(codes);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr-${batchId}-a4.pdf"`,
      },
    });
  }

  const pdf = await buildLabelPdf(codes);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="qr-${batchId}-label.pdf"`,
    },
  });
}

async function buildA4Pdf(codes: QrCode[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const cols = 3;
  const rows = 4;
  const cellW = pageWidth / cols;
  const cellH = pageHeight / rows;
  const perPage = cols * rows;

  for (let i = 0; i < codes.length; i += perPage) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    const slice = codes.slice(i, i + perPage);
    for (let j = 0; j < slice.length; j++) {
      const code = slice[j];
      const col = j % cols;
      const row = Math.floor(j / cols);
      const x = col * cellW;
      const y = pageHeight - (row + 1) * cellH;

      const png = await QRCode.toBuffer(qrPageUrl(code.token), {
        type: "png",
        margin: 1,
        width: 180,
      });
      const image = await pdf.embedPng(png);
      const size = 120;
      page.drawImage(image, {
        x: x + (cellW - size) / 2,
        y: y + 36,
        width: size,
        height: size,
      });
      page.drawText(code.display_code, {
        x: x + 16,
        y: y + 18,
        size: 9,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    }
  }

  return pdf.save();
}

async function buildLabelPdf(codes: QrCode[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const labelW = 141.73;
  const labelH = 85.04;

  for (const code of codes) {
    const page = pdf.addPage([labelW, labelH]);
    const png = await QRCode.toBuffer(qrPageUrl(code.token), {
      type: "png",
      margin: 1,
      width: 128,
    });
    const image = await pdf.embedPng(png);
    page.drawImage(image, { x: 8, y: 18, width: 56, height: 56 });
    page.drawText("Asset QR", {
      x: 70,
      y: 55,
      size: 7,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(code.display_code, {
      x: 70,
      y: 40,
      size: 7,
      font,
      color: rgb(0, 0, 0),
      maxWidth: 64,
    });
  }

  return pdf.save();
}

function buildZip(files: { name: string; data: Buffer }[]) {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc32(file.data), 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    chunks.push(local, file.data);

    const cen = Buffer.alloc(46 + nameBuf.length);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc32(file.data), 16);
    cen.writeUInt32LE(file.data.length, 20);
    cen.writeUInt32LE(file.data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    nameBuf.copy(cen, 46);
    central.push(cen);
    offset += local.length + file.data.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, end]);
}

function crc32(buf: Buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
