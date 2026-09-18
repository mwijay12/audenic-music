/**
 * Cloudflare R2 Song & Reel Upload Service.
 * Uploads audio/video files to Cloudflare R2 bucket (`mwijay-music`)
 * and streams them directly from Cloudflare R2 public CDN URL.
 */

import { ENV } from "./envKeys";

export type UploadResult = {
  ok: boolean;
  url: string;
  filename: string;
  size: number;
  message: string;
};

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoObj = typeof window !== "undefined" && window.crypto?.subtle ? window.crypto : (globalThis as any).crypto;
  const cryptoKey = await cryptoObj.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return await cryptoObj.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const cryptoObj = typeof window !== "undefined" && window.crypto?.subtle ? window.crypto : (globalThis as any).crypto;
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await cryptoObj.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Upload a File or Blob directly to Cloudflare R2 bucket (`mwijay-music`).
 * Signs with AWS SigV4 and returns the public CDN URL for streaming.
 */
export async function uploadToCloudflareR2(
  file: File | Blob,
  filename?: string
): Promise<UploadResult> {
  const name = filename || (file instanceof File ? file.name : `track_${Date.now()}.mp3`);
  const cleanName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectKey = `uploads/${Date.now()}_${cleanName}`;
  const publicUrl = `${ENV.r2.publicUrl.replace(/\/$/, "")}/${objectKey}`;

  if (ENV.r2.endpoint && ENV.r2.accessKeyId && ENV.r2.secretAccessKey) {
    try {
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]/g, "").replace(/\.\d{3}/, "");
      const dateStamp = amzDate.slice(0, 8);
      const region = "auto";
      const service = "s3";
      const host = new URL(ENV.r2.endpoint).host;
      const path = `/${ENV.r2.bucketName}/${objectKey}`;

      const arrayBuffer = await file.arrayBuffer();
      const payloadHash = await sha256Hex(arrayBuffer);

      const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
      const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
      const canonicalRequest = `PUT\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
      const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

      const kSecret = new TextEncoder().encode(`AWS4${ENV.r2.secretAccessKey}`);
      const kDate = await hmacSha256(kSecret, dateStamp);
      const kRegion = await hmacSha256(kDate, region);
      const kService = await hmacSha256(kRegion, service);
      const kSigning = await hmacSha256(kService, "aws4_request");
      const signatureBuf = await hmacSha256(kSigning, stringToSign);
      const signature = Array.from(new Uint8Array(signatureBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

      const authHeader = `AWS4-HMAC-SHA256 Credential=${ENV.r2.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      const uploadUrl = `https://${host}${path}`;
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Host": host,
          "x-amz-date": amzDate,
          "x-amz-content-sha256": payloadHash,
          "Authorization": authHeader,
          "Content-Type": file.type || "audio/mpeg",
        },
        body: arrayBuffer,
      });

      if (res.ok) {
        return {
          ok: true,
          url: publicUrl,
          filename: cleanName,
          size: file.size,
          message: "Uploaded successfully to Cloudflare R2 CDN!",
        };
      } else {
        const errText = await res.text().catch(() => "");
        console.error("[Cloudflare R2 Upload Error]", res.status, res.statusText, errText);
        return {
          ok: false,
          url: "",
          filename: cleanName,
          size: file.size,
          message: `Cloudflare R2 HTTP ${res.status}: ${res.statusText || "Upload failed"}`,
        };
      }
    } catch (err: any) {
      console.error("[Cloudflare R2 Upload Network Error]", err);
      return {
        ok: false,
        url: "",
        filename: cleanName,
        size: file.size,
        message: `Cloudflare R2 upload error: ${err?.message || String(err)}`,
      };
    }
  }

  const localUrl = URL.createObjectURL(file);
  return {
    ok: true,
    url: localUrl,
    filename: cleanName,
    size: file.size,
    message: "Local blob generated (Cloudflare R2 keys not configured).",
  };
}
