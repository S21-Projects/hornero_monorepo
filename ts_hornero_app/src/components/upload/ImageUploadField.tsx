'use client';

import { useRef, useState } from 'react';
import { getPresignUrl, getContentType, type UploadTarget } from '@/lib/api/upload';

interface ImageUploadFieldProps {
  label: string;
  currentUrl?: string;
  onUploaded: (publicUrl: string) => void;
  uploadType: UploadTarget;
  entityId?: number;
  /** Aspect ratio hint for the preview area, e.g. "1 / 1" or "16 / 9" */
  aspectRatio?: string;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function ImageUploadField({
  label,
  currentUrl,
  onUploaded,
  uploadType,
  entityId,
  aspectRatio = '16 / 9',
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side guard: size
    if (file.size > MAX_SIZE_BYTES) {
      setError('La imagen no puede superar 5 MB.');
      return;
    }

    // Client-side guard: content type
    const contentType = getContentType(file.name);
    if (!contentType) {
      setError('Solo se aceptan imágenes JPEG, PNG o WebP.');
      return;
    }

    setIsUploading(true);
    try {
      // 1. Get presigned URL from BFF
      const { uploadUrl, publicUrl } = await getPresignUrl(
        uploadType,
        file.name,
        contentType,
        entityId,
      );

      // 2. PUT binary directly to S3/Tigris
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Upload failed: ${putRes.status}`);
      }

      // 3. Update local preview and notify parent
      setPreviewUrl(publicUrl);
      onUploaded(publicUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al subir la imagen.';
      setError(message);
    } finally {
      setIsUploading(false);
      // Reset the file input so the same file can be re-selected after an error
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</label>

      {/* Preview */}
      <div
        style={{
          width: '100%',
          aspectRatio,
          borderRadius: 10,
          background: 'var(--card-2)',
          border: '1.5px dashed var(--line)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: 'pointer',
        }}
        onClick={() => !isUploading && inputRef.current?.click()}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>
            {isUploading ? 'Subiendo…' : 'Click para seleccionar imagen'}
          </span>
        )}

        {isUploading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--horn)',
            }}
          >
            Subiendo…
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {error && (
        <span style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 600 }}>{error}</span>
      )}
    </div>
  );
}
