import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireEnv } from "@clg-ess/db";

let _s3Client: S3Client | null = null;

/**
 * Any S3-compatible object store (Backblaze B2 in production), configured by the S3_*
 * variables alone, so switching provider is configuration only (docs/ENV.md).
 */
export function getStorageClient(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: requireEnv("S3_REGION"),
      endpoint: requireEnv("S3_ENDPOINT"),
      credentials: {
        accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
      },
      // Checksums only where an operation requires one. The SDK default (WHEN_SUPPORTED)
      // signs the CRC32 of an empty body into every presigned PUT, so a real upload fails
      // it, and B2 has answered checksum headers with "Unsupported header".
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return _s3Client;
}

function storageBucket(): string {
  return requireEnv("S3_BUCKET");
}

/**
 * Generate a presigned PUT URL for client-direct upload to storage. The declared length is
 * signed into the URL (`X-Amz-SignedHeaders=content-length;host`), so storage refuses a PUT
 * of any other size, even one sent after `/complete` checked the first.
 */
export async function createPresignedUploadUrl(
  bucketKey: string,
  contentType: string,
  contentLength: number,
  expiresInSeconds = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: storageBucket(),
    Key: bucketKey,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  return await getSignedUrl(getStorageClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a presigned GET URL for viewing private assets.
 */
export async function createPresignedViewUrl(
  bucketKey: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: storageBucket(),
    Key: bucketKey,
  });

  return await getSignedUrl(getStorageClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * The size in bytes of an object in storage, from a real HEAD request, or `null` if there
 * is no such object. Only a 404 means "absent"; any other failure (bad credentials,
 * network) is thrown, because "could not check" must never be reported as an answer.
 */
export async function storedObjectSize(bucketKey: string): Promise<number | null> {
  try {
    const head = await getStorageClient().send(
      new HeadObjectCommand({
        Bucket: storageBucket(),
        Key: bucketKey,
      }),
    );
    if (head.ContentLength === undefined) {
      throw new Error(`Storage answered a HEAD for ${bucketKey} without a size`);
    }
    return head.ContentLength;
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (err instanceof NotFound || status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Delete an object from storage. On B2 this only hides it; the bucket's lifecycle rule
 * frees the space about a day later (docs/ENV.md, "Production").
 */
export async function deleteObjectFromStorage(bucketKey: string): Promise<void> {
  await getStorageClient().send(
    new DeleteObjectCommand({
      Bucket: storageBucket(),
      Key: bucketKey,
    }),
  );
}
