"use client";

import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/assets/compress";
import { type UploadFailure, type UploadResult, replaceProfilePhoto } from "@/lib/assets/upload";
import { authClient } from "@/lib/auth-client";
import { AlertCircle, Camera, Check, LoaderCircle, RotateCcw, User } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

const FAILURE_MESSAGES: Record<UploadFailure, string> = {
  not_an_image: "That file couldn't be read as a photo. Try another one.",
  quota: "Your photo storage is full, so this photo can't be saved.",
  storage_refused:
    "Your photo couldn't be uploaded right now. It's still here, so try again later. If this keeps happening, the app's photo storage may be full for today.",
  offline: "You're offline. Your photo is still here, so try again when you're connected.",
  server: "Something went wrong saving your photo. Try again.",
};

// Sending the same file again can't get past an unreadable file or a full quota.
const RETRYABLE = new Set<UploadFailure>(["storage_refused", "offline", "server"]);

const SAVED_NOTICE_MS = 2500;

type Status = { kind: "idle" | "uploading" | "saved" } | { kind: "failed"; reason: UploadFailure };

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export function ProfilePhoto({ name, image }: { name: string; image: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Moves to a new photo as soon as it is saved, so the next change deletes the right old
  // photo even before the session has caught up.
  const [assetId, setAssetId] = useState(image);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [brokenUrls, setBrokenUrls] = useState<ReadonlySet<string>>(() => new Set());
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    setAssetId(image);
  }, [image]);

  useEffect(() => {
    if (!assetId) {
      setViewUrl(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/assets/${assetId}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ viewUrl?: string }>) : null))
      .then((body) => {
        if (!cancelled) setViewUrl(body?.viewUrl ?? null);
      })
      .catch(() => {
        // The initials stand in.
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (status.kind !== "saved") return;
    const timer = setTimeout(() => setStatus({ kind: "idle" }), SAVED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const upload = async (photo: File) => {
    setStatus({ kind: "uploading" });
    let result: UploadResult;
    try {
      result = await replaceProfilePhoto(photo, {
        previous: assetId,
        setImage: async (next) => {
          const { error } = await authClient.updateUser({ image: next });
          if (error) throw new Error(error.message ?? "Could not save your profile photo");
        },
        compress: (blob) => compressImage(blob, { maxEdge: 512 }),
      });
    } catch {
      // Expected failures come back as a result; a throw means the profile could not be
      // pointed at the uploaded photo.
      result = { ok: false, reason: "server" };
    }
    if (result.ok) {
      setAssetId(result.assetId);
      setStatus({ kind: "saved" });
    } else {
      setStatus({ kind: "failed", reason: result.reason });
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    // Cleared so that choosing the same file again still fires a change.
    event.target.value = "";
    if (!chosen) return;
    setFile(chosen);
    void upload(chosen);
  };

  // A file the browser can't display falls back to the saved photo, then to the initials.
  const src = [previewUrl, viewUrl].find((url) => url && !brokenUrls.has(url));
  const initials = initialsOf(name);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          {src ? (
            <img
              src={src}
              alt=""
              data-testid={src === previewUrl ? "profile-photo-preview" : undefined}
              onError={() => setBrokenUrls((urls) => new Set(urls).add(src))}
              className="h-full w-full object-cover"
            />
          ) : initials ? (
            <span
              aria-hidden="true"
              className="text-2xl font-semibold text-[var(--text-secondary)]"
            >
              {initials}
            </span>
          ) : (
            <User aria-hidden="true" className="h-8 w-8 text-[var(--text-secondary)]" />
          )}
        </div>

        <div className="flex min-w-0 flex-col items-start gap-1">
          <Button
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={status.kind === "uploading"}
          >
            <Camera className="h-4 w-4" />
            <span>Change photo</span>
          </Button>
          <p
            aria-live="polite"
            className="flex min-h-4 items-center gap-1.5 text-xs text-[var(--text-secondary)]"
          >
            {status.kind === "uploading" && (
              <>
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                <span>Uploading…</span>
              </>
            )}
            {status.kind === "saved" && (
              <>
                <Check className="h-3.5 w-3.5 text-[var(--success)]" />
                <span>Photo saved</span>
              </>
            )}
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="profile-photo-input"
          onChange={handleFile}
        />
      </div>

      {status.kind === "failed" && (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-3.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]" />
            <p
              role="alert"
              data-testid="profile-photo-error"
              className="text-sm text-[var(--text-primary)]"
            >
              {FAILURE_MESSAGES[status.reason]}
            </p>
          </div>
          {RETRYABLE.has(status.reason) && file && (
            <Button variant="secondary" onClick={() => void upload(file)}>
              <RotateCcw className="h-4 w-4" />
              <span>Try again</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
