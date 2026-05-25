/**
 * Cloud sync helpers — Google Drive (service account) + Dropbox (access token).
 * No extra npm packages — uses Node.js built-in crypto + fetch.
 */
import crypto from "crypto";
import { db } from "./db";

// ── Google Drive ─────────────────────────────────────────────────────────────

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function getGoogleAccessToken(credentialsJson: string): Promise<string> {
  const creds = JSON.parse(credentialsJson) as {
    client_email: string;
    private_key: string;
  };

  const now = Math.floor(Date.now() / 1000);
  const header  = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss:   creds.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud:   "https://oauth2.googleapis.com/token",
    exp:   now + 3600,
    iat:   now,
  }));

  const sigInput = `${header}.${payload}`;
  const sign     = crypto.createSign("RSA-SHA256");
  sign.update(sigInput);
  const sig = sign.sign(creds.private_key, "base64url");
  const jwt = `${sigInput}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Google auth failed: ${data.error}`);
  return data.access_token;
}

export async function uploadToGoogleDrive(
  credentialsJson: string,
  folderId: string,
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<string> {
  const token    = await getGoogleAccessToken(credentialsJson);
  const metadata = JSON.stringify({
    name:    filename,
    parents: folderId ? [folderId] : [],
  });

  const boundary = `rv_boundary_${Date.now()}`;
  const bodyBuf = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method:  "POST",
      headers: {
        Authorization:   `Bearer ${token}`,
        "Content-Type":  `multipart/related; boundary="${boundary}"`,
      },
      body:   new Uint8Array(bodyBuf),
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Drive upload failed (${res.status}): ${err}`);
  }

  const file = await res.json() as { id: string };
  return file.id;
}

// ── Dropbox ──────────────────────────────────────────────────────────────────

export async function uploadToDropbox(
  token: string,
  folder: string,
  filename: string,
  buffer: Buffer
): Promise<void> {
  const path = `${folder.replace(/\/$/, "")}/${filename}`;

  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method:  "POST",
    headers: {
      Authorization:     `Bearer ${token}`,
      "Content-Type":    "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path,
        mode:        "add",
        autorename:  true,
        mute:        true,
      }),
    },
    body:   new Uint8Array(buffer),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dropbox upload failed (${res.status}): ${err}`);
  }
}

// ── Unified trigger ──────────────────────────────────────────────────────────

/**
 * Called after a receipt file is saved. Fire-and-forget — never blocks upload.
 */
export function syncReceiptToCloud(
  filename: string,
  mimeType: string,
  buffer: Buffer
): void {
  _syncToCloud(filename, mimeType, buffer).catch((err) =>
    console.error("[cloudsync] error:", err)
  );
}

async function _syncToCloud(
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<void> {
  // Lazily load settings to avoid circular deps at startup
  const settings = await db.appSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) return;

  if (settings.googleDriveEnabled && settings.googleDriveCredentials) {
    try {
      const fileId = await uploadToGoogleDrive(
        settings.googleDriveCredentials,
        settings.googleDriveFolderId,
        filename,
        mimeType,
        buffer
      );
      console.log(`[cloudsync] Google Drive ✓ fileId=${fileId}`);
    } catch (err) {
      console.error("[cloudsync] Google Drive failed:", err);
    }
  }

  if (settings.dropboxEnabled && settings.dropboxToken) {
    try {
      await uploadToDropbox(
        settings.dropboxToken,
        settings.dropboxFolder || "/ReceiptVault",
        filename,
        buffer
      );
      console.log(`[cloudsync] Dropbox ✓ ${filename}`);
    } catch (err) {
      console.error("[cloudsync] Dropbox failed:", err);
    }
  }
}
