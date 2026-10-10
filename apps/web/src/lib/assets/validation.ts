import { uuidv7 } from "uuidv7";

export const ALLOWED_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "application/pdf",
];

export const PURPOSE_MAX_BYTES: Record<string, number> = {
  profile_photo: 1 * 1024 * 1024, // 1 MB
  garment_photo: 2 * 1024 * 1024, // 2 MB
  attachment: 5 * 1024 * 1024, // 5 MB
  default: 5 * 1024 * 1024, // 5 MB
};

export const USER_STORAGE_QUOTA_BYTES = 50 * 1024 * 1024; // 50 MB per student

/**
 * How long a soft-deleted asset row is kept before the reaper deletes it for good. After
 * that it leaves no tombstone, so the sync pull treats a device away longer than this as
 * new (a full pull, `GET /api/sync`).
 */
export const DELETED_ASSET_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function isAllowedMimeType(mime: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mime);
}

export function getMaxBytesForPurpose(purpose?: string): number {
  if (purpose && purpose in PURPOSE_MAX_BYTES) {
    return PURPOSE_MAX_BYTES[purpose] ?? 5 * 1024 * 1024;
  }
  return PURPOSE_MAX_BYTES.default ?? 5 * 1024 * 1024;
}

export function getExtensionFromMime(mime: string): string {
  switch (mime) {
    case "image/webp":
      return "webp";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

/**
 * Derives a secure, server-controlled bucket key.
 * Any client-supplied bucket_key MUST BE IGNORED to prevent arbitrary overwrites.
 */
export function deriveBucketKey(userId: string, mime: string, purpose = "general"): string {
  const sanitizedPurpose = purpose.replace(/[^a-zA-Z0-9_-]/g, "");
  const ext = getExtensionFromMime(mime);
  return `users/${userId}/${sanitizedPurpose}/${uuidv7()}.${ext}`;
}
