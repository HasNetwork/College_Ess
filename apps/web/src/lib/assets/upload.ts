import { type CompressResult, compressImage } from "./compress";

// Browser side of the upload pipeline (PLAN §2.4). Imports ./compress directly: the
// ./index barrel also carries the storage client, which is server-only.

/** Why a photo was not uploaded, in terms a screen can explain. */
export type UploadFailure =
  /** The device couldn't read it as an image. Nothing left the device. */
  | "not_an_image"
  /** The account's storage allowance is used up. */
  | "quota"
  /** Storage turned the upload away (at a free limit B2 refuses requests, PLAN §4.1), or
   *  could not be reached. */
  | "storage_refused"
  /** The app could not be reached. */
  | "offline"
  /** The app refused or failed. */
  | "server";

export type UploadResult =
  | { ok: true; assetId: string; bytes: number }
  | { ok: false; reason: UploadFailure };

export interface UploadOptions {
  fetcher?: typeof fetch;
  /** How the photo is shrunk on the device before it is sent. */
  compress?: (file: Blob) => Promise<CompressResult>;
}

async function reachApp(fetcher: typeof fetch, url: string, init: RequestInit) {
  try {
    return await fetcher(url, init);
  } catch {
    return null;
  }
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * Shrinks a photo on the device, then uploads it: presign, PUT straight to storage,
 * complete. An expected failure is returned, never thrown, and the photo is never
 * discarded: the caller still holds `file`, so the student can try again.
 */
export async function uploadPhoto(
  file: Blob,
  purpose: string,
  { fetcher = fetch, compress = compressImage }: UploadOptions = {},
): Promise<UploadResult> {
  let photo: CompressResult;
  try {
    photo = await compress(file);
  } catch {
    return { ok: false, reason: "not_an_image" };
  }

  const presign = await reachApp(
    fetcher,
    "/api/assets/presign",
    json({ mime: photo.mime, bytes: photo.bytes, purpose }),
  );
  if (!presign) return { ok: false, reason: "offline" };
  if (presign.status === 403) return { ok: false, reason: "quota" };
  if (!presign.ok) return { ok: false, reason: "server" };
  const { assetId, uploadUrl } = (await presign.json()) as { assetId: string; uploadUrl: string };

  // Only content-type is sent: the bucket's CORS rule allows no other header (docs/ENV.md).
  // The URL is signed for exactly `photo.bytes`, which the browser sends as Content-Length.
  // A refusal can come back without CORS headers, which a browser reports as a network
  // error, so the two are the same failure here.
  let put: Response;
  try {
    put = await fetcher(uploadUrl, {
      method: "PUT",
      headers: { "content-type": photo.mime },
      body: photo.blob,
    });
  } catch {
    return { ok: false, reason: "storage_refused" };
  }
  if (!put.ok) return { ok: false, reason: "storage_refused" };

  const complete = await reachApp(
    fetcher,
    `/api/assets/${assetId}/complete`,
    json({ width: photo.width, height: photo.height }),
  );
  if (!complete) return { ok: false, reason: "offline" };
  if (!complete.ok) return { ok: false, reason: "server" };
  return { ok: true, assetId, bytes: photo.bytes };
}

export interface ProfilePhotoOptions extends UploadOptions {
  /** The asset id the profile shows now, if any. */
  previous: string | null;
  /** Points the profile at the new photo (Better Auth's `user.image` holds its asset id). */
  setImage: (assetId: string) => Promise<void>;
}

/**
 * Uploads a new profile photo and points the profile at it. Whichever photo ends up with
 * nothing pointing at it is deleted, so it stops counting against the quota: a completed
 * upload nothing points at is never reaped (PLAN §2.4).
 */
export async function replaceProfilePhoto(
  file: Blob,
  { previous, setImage, fetcher = fetch, ...options }: ProfilePhotoOptions,
): Promise<UploadResult> {
  const result = await uploadPhoto(file, "profile_photo", { fetcher, ...options });
  if (!result.ok) return result;
  try {
    await setImage(result.assetId);
  } catch (err) {
    // The profile still shows the old photo; the new one is the orphan.
    await reachApp(fetcher, `/api/assets/${result.assetId}`, { method: "DELETE" });
    throw err;
  }
  if (previous) await reachApp(fetcher, `/api/assets/${previous}`, { method: "DELETE" });
  return result;
}
