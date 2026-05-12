import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

export async function getPresignedUploadUrl(taskId: string, originalFilename: string) {
  const fileKey = `tasks/${taskId}/${uuidv4()}-${originalFilename}`;
  
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileKey,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  
  return {
    url,
    fileKey,
    publicUrl: `${process.env.R2_PUBLIC_DOMAIN}/${fileKey}`
  };
}
