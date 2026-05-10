import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function isMockMode(): boolean {
  return !process.env["R2_ENDPOINT"];
}

export function getS3Client(): S3Client {
  if (client) return client;
  const endpoint = process.env["R2_ENDPOINT"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"] ?? "";
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"] ?? "";
  const region = "auto";

  client = new S3Client({
    ...(endpoint ? { endpoint } : {}),
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return client;
}

export function getBucket(): string {
  return process.env["R2_BUCKET"] ?? "basira-deliverables-dev";
}

export function getPublicBase(): string {
  const endpoint = process.env["R2_ENDPOINT"] ?? "https://mock.invalid";
  const bucket = getBucket();
  return `${endpoint}/${bucket}`;
}
