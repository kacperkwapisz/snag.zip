import { S3Client } from "bun";
import { config } from "./config";
import { safeContentDisposition } from "./lib/format";

export const s3 = new S3Client({
  endpoint: config.s3.endpoint,
  bucket: config.s3.bucket,
  accessKeyId: config.s3.accessKeyId,
  secretAccessKey: config.s3.secretAccessKey,
});

export function uploadFile(key: string, data: Blob | ArrayBuffer | Uint8Array, filename: string) {
  return s3.file(key).write(data, {
    type: data instanceof Blob ? data.type : undefined,
    contentDisposition: safeContentDisposition(filename),
  });
}

export function getFile(key: string) {
  return s3.file(key);
}

export function presignUrl(key: string, filename: string, expiresIn = 60) {
  return s3.file(key).presign({
    expiresIn,
    contentDisposition: safeContentDisposition(filename),
  });
}

export function deleteFile(key: string) {
  return s3.file(key).delete();
}
