import { useRef, useState, type DragEvent } from 'react';
import { Text } from './Typography';

interface ImageDropZoneProps {
  label: string;
  hint?: string;
  currentSrc?: string | null;
  preview?: string | null;
  isUploading: boolean;
  aspect?: 'square' | 'banner';
  onFile: (file: File) => void;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/** Click-or-drag image uploader. */
export function ImageDropZone({
  label,
  hint = 'JPG, PNG o WEBP · Máx. 5 MB',
  currentSrc,
  preview,
  isUploading,
  aspect = 'square',
  onFile,
}: ImageDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const displaySrc = preview ?? currentSrc ?? null;
  const minHeight = aspect === 'banner' ? 120 : 140;

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && ACCEPTED.includes(file.type)) onFile(file);
  }

  function handleChange() {
    const file = inputRef.current?.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Text as="span" variant="label" color="ink-2">{label}</Text>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Subir ${label}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          minHeight,
          padding: 16,
          boxSizing: 'border-box',
          borderRadius: 12,
          border: `2px dashed ${isDragging ? 'var(--horn)' : 'var(--line)'}`,
          background: isDragging ? 'var(--straw)' : 'var(--card-2)',
          cursor: 'pointer',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color .15s, background .15s',
        }}
      >
        {displaySrc && (
          <img
            src={displaySrc}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: isUploading ? 0.4 : 1,
              transition: 'opacity .2s',
            }}
          />
        )}

        {isUploading ? (
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--horn)" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
              </path>
            </svg>
            <Text variant="caption" color="ink-3">Subiendo...</Text>
          </div>
        ) : !displaySrc ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <Text variant="caption" color="ink-3">
              Arrastrá una imagen o hacé click para seleccionar
            </Text>
            <Text variant="caption" color="ink-3" style={{ opacity: 0.7, fontSize: 11 }}>{hint}</Text>
          </div>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
          >
            <div style={{ background: 'rgba(0,0,0,.45)', borderRadius: 8, padding: '4px 10px' }}>
              <Text variant="caption" style={{ color: '#fff' }}>Cambiar imagen</Text>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
