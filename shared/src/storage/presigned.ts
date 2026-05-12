import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import type { PresignedUpload } from "./types";
import { isMockMode, getS3Client, getBucket, getPublicBase } from "./client";

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const TTL_SECONDS = 15 * 60; // 15 minutes

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\.[/\\]/g, "") // strip path traversal sequences
    .replace(/^[/\\]+/, "")    // strip leading slashes
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, "") // strip control chars
    .replace(/[^a-zA-Z0-9._\-]/g, "_"); // only safe chars
}

export interface PresignedUploadRequest {
  taskId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export async function getPresignedUploadUrl({
  taskId,
  filename,
  contentType,
  sizeBytes,
}: PresignedUploadRequest): Promise<PresignedUpload> {
  if (sizeBytes > MAX_SIZE_BYTES) {
    throw new Error(
      `File size ${sizeBytes} exceeds maximum of ${MAX_SIZE_BYTES} bytes`,
    );
  }

  const safe = sanitizeFilename(filename);
  const key = `tasks/${taskId}/${randomUUID()}-${safe}`;
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);

  if (isMockMode()) {
    return {
      url: `https://mock.invalid/uploads/${key}`,
      finalUrl: `https://mock.invalid/uploads/${key}`,
      key,
      expiresAt,
    };
  }

  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });

  const url = await getSignedUrl(getS3Client(), command, {
    expiresIn: TTL_SECONDS,
  });

  return {
    url,
    finalUrl: `${getPublicBase()}/${key}`,
    key,
    expiresAt,
  };
}
