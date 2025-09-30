"use client";

import React, { useRef, useState } from "react";
import { downscaleImageFile } from "@/lib/image-opt";

export default function AdminImageUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setMsg("Optimalizujem…");

      // 1) downscale + recompress → WebP/AVIF ~1600px
      const optimized = await downscaleImageFile(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        mimeType: "image/webp",
        quality: 0.82,
      });

      setMsg("Nahrávam…");

      // 2) upload priamo do nášho API (ktoré uloží do Blob Storage)
      const res = await fetch("/api/upload", {
        method: "POST",
        // tip: keď pošleme čistý Blob, prehliadač nastaví správny content-type
        headers: {
          "content-type": (optimized as any).type || "application/octet-stream",
        },
        body: optimized,
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      setUrl(data.url);
      setMsg("✅ Hotovo");
    } catch (e: any) {
      console.error(e);
      setMsg(`❌ ${e?.message || "Chyba pri uploade"}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          className="px-3 py-1 rounded bg-neutral-800 text-white disabled:opacity-50"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Prebieha…" : "Vybrať obrázok"}
        </button>
      </div>

      {msg && <p className="text-sm text-neutral-500">{msg}</p>}

      {url && (
        <p className="text-sm">
          URL:{" "}
          <a href={url} target="_blank" rel="noreferrer" className="text-blue-500 underline">
            {url}
          </a>
        </p>
      )}
    </div>
  );
}
