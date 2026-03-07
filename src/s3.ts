import { S3Client as BunS3Client } from "bun";
import {
  S3Client,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config";
import { safeContentDisposition } from "./lib/format";

export const s3 = new BunS3Client({
  endpoint: config.s3.endpoint,
  bucket: config.s3.bucket,
  accessKeyId: config.s3.accessKeyId,
  secretAccessKey: config.s3.secretAccessKey,
});

const awsS3 = new S3Client({
  endpoint: config.s3.endpoint,
  region: "auto",
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  forcePathStyle: true,
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

// --- Multipart upload helpers ---

export async function createMultipartUpload(
  key: string,
  contentType: string,
  filename: string,
): Promise<string> {
  const cmd = new CreateMultipartUploadCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ContentType: contentType,
    ContentDisposition: safeContentDisposition(filename),
  });
  const res = await awsS3.send(cmd);
  return res.UploadId!;
}

export async function presignUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 300,
): Promise<string> {
  const cmd = new UploadPartCommand({
    Bucket: config.s3.bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(awsS3, cmd, { expiresIn });
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
): Promise<void> {
  const cmd = new CompleteMultipartUploadCommand({
    Bucket: config.s3.bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map((p) => ({
        PartNumber: p.partNumber,
        ETag: p.etag,
      })),
    },
  });
  await awsS3.send(cmd);
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string,
): Promise<void> {
  const cmd = new AbortMultipartUploadCommand({
    Bucket: config.s3.bucket,
    Key: key,
    UploadId: uploadId,
  });
  await awsS3.send(cmd);
}
