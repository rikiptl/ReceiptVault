import { NextRequest, NextResponse } from "next/server";
import { uploadToGoogleDrive, uploadToDropbox } from "@/lib/cloudsync";
import { db } from "@/lib/db";

/**
 * POST /api/settings/sync-test?provider=google|dropbox
 * Uploads a tiny text file to verify credentials work.
 */
export async function POST(req: NextRequest) {
  const provider = new URL(req.url).searchParams.get("provider");
  const settings = await db.appSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) return NextResponse.json({ ok: false, error: "No settings saved yet" }, { status: 400 });

  const testBuffer = Buffer.from(`ReceiptVault connection test — ${new Date().toISOString()}`);

  try {
    if (provider === "google") {
      if (!settings.googleDriveCredentials) throw new Error("No Google credentials saved");
      const fileId = await uploadToGoogleDrive(
        settings.googleDriveCredentials,
        settings.googleDriveFolderId,
        "receiptvault-connection-test.txt",
        "text/plain",
        testBuffer
      );
      return NextResponse.json({ ok: true, message: `Test file uploaded (id: ${fileId})` });
    }

    if (provider === "dropbox") {
      if (!settings.dropboxToken) throw new Error("No Dropbox token saved");
      await uploadToDropbox(
        settings.dropboxToken,
        settings.dropboxFolder || "/ReceiptVault",
        "receiptvault-connection-test.txt",
        testBuffer
      );
      return NextResponse.json({ ok: true, message: "Test file uploaded to Dropbox" });
    }

    return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
