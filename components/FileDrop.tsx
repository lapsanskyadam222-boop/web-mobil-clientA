'use client';
import { upload } from '@vercel/blob/client';
import { useRef, useState } from 'react';

export function FileDrop({
  label,
  multiple = false,
  maxPerFileMB = 10,
  accept = 'image/jpeg',
  onUploaded,
}: {
  label: string;
  multiple?: boolean;
  maxPerFileMB?: number;
  accept?: string;               // podporuje viac MIME oddelených čiarkou, napr. 'image/png,image/jpeg'
  onUploaded: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleFiles = async (files: FileList) => {
    const maxBytes = maxPerFileMB * 1024 * 1024;
    const arr = Array.from(files);

    // povolené MIME typy podľa accept reťazca
    const allowed = accept
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    for (const f of arr) {
      const type = (f.type || '').toLowerCase();
      if (!allowed.some((a) => a === type)) {
        setErr(`Nepovolený typ: ${f.name} (${type || 'neznámy'})`);
        return;
      }
      if (f.size > maxBytes) {
        setErr(`Súbor ${f.name} je väčší než ${maxPerFileMB} MB`);
        return;
      }
    }

    setErr('');
    setBusy(true);
    try {
      const results = await Promise.all(
        arr.map((f) =>
          upload(f.name, f, {
            access: 'public',
            handleUploadUrl: '/api/blob/upload',
          }),
        ),
      );
      onUploaded(results.map((r) => r.url));
    } catch (e: any) {
      setErr(e?.message || 'Upload zlyhal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <div
        className="border-2 border-dashed rounded p-4 text-center cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        Presuň sem súbory alebo klikni na výber.
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {busy && <p>Nahrávam…</p>}
      {err && <p className="text-red-600 text-sm">{err}</p>}
    </div>
  );
}
