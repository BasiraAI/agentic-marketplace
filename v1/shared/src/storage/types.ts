export interface PresignedUpload {
  url: string;
  finalUrl: string;
  key: string;
  expiresAt: Date;
}

export interface StorageObject {
  key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
}
