"use client";
import React, { useState } from "react";

export default function AdminImageUploader() {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: file, // posielame raw body
      });

      const data = await res.json();
      setUrl(data.url);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      {uploading && <p>Nahrávam...</p>}
      {url && (
        <p>
          ✅ Upload hotový:{" "}
          <a href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </p>
      )}
    </div>
  );
}
