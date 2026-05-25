import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/settings — returns singleton AppSettings (creates if missing) */
export async function GET() {
  const settings = await db.appSettings.upsert({
    where:  { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  // Redact secrets in the response — send back a mask so the UI shows "saved"
  return NextResponse.json({
    ...settings,
    googleDriveCredentials: settings.googleDriveCredentials ? "***" : "",
    dropboxToken:           settings.dropboxToken           ? "***" : "",
    resendApiKey:           settings.resendApiKey           ? "***" : "",
  });
}

/** PATCH /api/settings — upserts the singleton row */
export async function PATCH(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;

  const allowed = [
    "googleDriveEnabled", "googleDriveCredentials", "googleDriveFolderId",
    "dropboxEnabled",     "dropboxToken",            "dropboxFolder",
    "slackWebhookUrl",
    "resendApiKey",       "digestFromEmail",          "digestToEmail",
  ];

  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    // Only overwrite secrets when the user sends a real value (not "***")
    if (k in body && body[k] !== "***") data[k] = body[k];
  }

  const settings = await db.appSettings.upsert({
    where:  { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  return NextResponse.json({ ok: true, id: settings.id });
}
