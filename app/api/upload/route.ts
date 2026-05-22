import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { runOcr } from "@/lib/ocr";

const UPLOAD_DIR = process.env.UPLOAD_PATH ?? path.join(process.cwd(), "uploads");
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, WebP, or PDF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 400 }
      );
    }

    // Save file to disk first so we can run OCR for duplicate check
    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `${uuidv4()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // ── Duplicate detection ────────────────────────────────────────────────
    // We check after OCR completes synchronously for a quick pre-check using
    // filename similarity, then async OCR will do field-level dedup.
    // For now: check if a receipt with same originalName + same size exists
    // (catches re-uploads of the same file before OCR runs).
    const sameFile = await db.receipt.findFirst({
      where: {
        originalName: file.name,
        fileSize: file.size,
      },
      select: {
        id: true,
        merchant: true,
        date: true,
        total: true,
      },
    });

    if (sameFile) {
      // Delete the duplicate file we just saved
      const { unlink } = await import("fs/promises");
      unlink(filePath).catch(() => {});

      return NextResponse.json(
        {
          duplicate: {
            id: sameFile.id,
            merchant: sameFile.merchant ?? "Unknown",
            date: sameFile.date ?? "",
            total: sameFile.total ?? "",
          },
        },
        { status: 409 }
      );
    }

    // Create receipt record (ocrDone = false initially)
    const receipt = await db.receipt.create({
      data: {
        filename,
        originalName: file.name,
        filePath,
        mimeType: file.type,
        fileSize: file.size,
        ocrDone: false,
      },
    });

    // Run OCR in background — after it completes it will do field-level
    // duplicate detection (same merchant + total + date)
    runOcr(receipt.id, filePath, file.type, buffer).catch((err) => {
      console.error(`OCR failed for ${receipt.id}:`, err);
    });

    return NextResponse.json({ id: receipt.id }, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
