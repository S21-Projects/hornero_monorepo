'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { type OrganizacionResponse } from '@/lib/api/organizaciones';
import { type TipoOrganizacion, TIPO_ORGANIZACION_OPTIONS } from '@/lib/tipos-organizacion';
import { useUpdateOrgMutation } from '@/hooks/useUpdateOrgMutation';
import { api } from '@/lib/axios';
import { ImageDropZone } from '@/components/upload/ImageDropZone';

interface OrgEditFormProps {
  org: OrganizacionResponse;
  onClose: () => void;
}

const BFF = process.env.NEXT_PUBLIC_BFF_URL ?? '';

function parseNumber(value: string): number | undefined {
  const n = parseFloat(value);
  return isNaN(n) ? undefined : n;
}

export function OrgEditForm({ org, onClose }: OrgEditFormProps) {
  const router = useRouter();
  const { mutate, isPending } = useUpdateOrgMutation();

  const [nombre, setNombre] = useState(org.nombre ?? '');
  const [tipo, setTipo] = useState<TipoOrganizacion | ''>(org.tipo ?? '');
  const [descripcion, setDescripcion] = useState(org.descripcion ?? '');
  const [direccion, setDireccion] = useState(org.direccion ?? '');
  const [latitud, setLatitud] = useState(org.latitud?.toString() ?? '');
  const [longitud, setLongitud] = useState(org.longitud?.toString() ?? '');
  const [error, setError] = useState('');

  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [profileKey, setProfileKey] = useState<string | null>(org.profileImageKey ?? null);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);

  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerKey, setBannerKey] = useState<string | null>(org.bannerKey ?? null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  async function uploadFile(endpoint: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const { data } = await api.post<{ key: string }>(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.key;
  }

  async function handleProfileFile(file: File) {
    setProfilePreview(URL.createObjectURL(file));
    setIsUploadingProfile(true);
    setError('');
    try {
      const key = await uploadFile(`/upload/org-profile/${org.id}`, file);
      setProfileKey(key);
    } catch {
      setError('No se pudo subir la imagen de perfil. Intentá de nuevo.');
      setProfilePreview(null);
    } finally {
      setIsUploadingProfile(false);
    }
  }

  async function handleBannerFile(file: File) {
    setBannerPreview(URL.createObjectURL(file));
    setIsUploadingBanner(true);
    setError('');
    try {
      const key = await uploadFile(`/upload/org-banner/${org.id}`, file);
      setBannerKey(key);
    } catch {
      setError('No se pudo subir el banner. Intentá de nuevo.');
      setBannerPreview(null);
    } finally {
      setIsUploadingBanner(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const payload: Record<string, unknown> = {};
    if (nombre.trim()) payload.nombre = nombre.trim();
    if (tipo) payload.tipo = tipo;
    if (descripcion.trim()) payload.descripcion = descripcion.trim();
    if (direccion.trim()) payload.direccion = direccion.trim();
    const lat = parseNumber(latitud);
    if (lat !== undefined) payload.latitud = lat;
    const lng = parseNumber(longitud);
    if (lng !== undefined) payload.longitud = lng;
    if (profileKey) payload.profileImageKey = profileKey;
    if (bannerKey) payload.bannerKey = bannerKey;

    mutate(
      { id: org.id, payload },
      {
        onSuccess: () => {
          router.refresh();
          onClose();
        },
        onError: () => {
          setError('No se pudo actualizar la organización. Intentá de nuevo.');
        },
      },
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px 16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--r-card)',
          padding: 32,
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text variant="h3" as="h2">Editar organización</Text>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1 }}
            aria-label="Cerrar"
          >
            <Text variant="body" color="ink-3">✕</Text>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ImageDropZone
            label="Imagen de perfil"
            aspect="square"
            currentSrc={profileKey ? `${BFF}/images?key=${profileKey}` : null}
            preview={profilePreview}
            isUploading={isUploadingProfile}
            onFile={handleProfileFile}
          />

          <ImageDropZone
            label="Banner"
            aspect="banner"
            currentSrc={bannerKey ? `${BFF}/images?key=${bannerKey}` : null}
            preview={bannerPreview}
            isUploading={isUploadingBanner}
            onFile={handleBannerFile}
          />

          <Input
            id="edit-nombre"
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la organización"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="edit-tipo">
              <Text as="span" variant="label" color="ink-2">Tipo de organización</Text>
            </label>
            <select
              id="edit-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoOrganizacion | '')}
              style={{
                fontFamily: 'inherit',
                fontSize: 14.5,
                color: tipo ? 'var(--ink)' : 'var(--ink-3)',
                background: '#fff',
                border: '1.5px solid var(--line)',
                borderRadius: 'var(--r-input)',
                padding: '12px 14px',
                width: '100%',
                outline: 'none',
                appearance: 'auto',
              }}
            >
              <option value="">Seleccioná un tipo</option>
              {TIPO_ORGANIZACION_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <Input
            id="edit-descripcion"
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción opcional"
          />

          <Input
            id="edit-direccion"
            label="Dirección"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Av. Colón 1234, Córdoba"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              id="edit-latitud"
              label="Latitud"
              type="number"
              step="any"
              value={latitud}
              onChange={(e) => setLatitud(e.target.value)}
              placeholder="-31.4167"
            />
            <Input
              id="edit-longitud"
              label="Longitud"
              type="number"
              step="any"
              value={longitud}
              onChange={(e) => setLongitud(e.target.value)}
              placeholder="-64.1833"
            />
          </div>

          {error && (
            <div
              style={{
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: 10,
                padding: '10px 14px',
              }}
            >
              <Text variant="label" style={{ color: '#DC2626' }}>{error}</Text>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Button type="submit" variant="primary" block loading={isPending}>
              Guardar cambios
            </Button>
            <Button type="button" variant="secondary" block onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
