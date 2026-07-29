import { useState } from 'react';
import { ImageDropZone } from '../ui/ImageDropZone';
import { Text } from '../ui/Typography';
import { useUploadOrgProfile, useUploadOrgBanner } from '../../lib/hooks/useUploadOrgImagen';

const BFF_URL = import.meta.env.VITE_BFF_URL as string;

function imageUrl(key: string | null | undefined): string | null {
  return key ? `${BFF_URL}/images?key=${key}` : null;
}

interface OrgImagesEditorProps {
  organizacionId: number;
  profileImageKey?: string | null;
  bannerKey?: string | null;
}

/**
 * Profile + banner uploaders for an organización. Reused by the referente's
 * own org editor (mis-organizaciones) and the admin moderation view
 * (referentes) — the BFF endpoint decides ownership-vs-admin server-side,
 * so this component doesn't need a "mode" prop.
 */
export function OrgImagesEditor({ organizacionId, profileImageKey, bannerKey }: OrgImagesEditorProps) {
  const uploadProfile = useUploadOrgProfile();
  const uploadBanner = useUploadOrgBanner();
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  function handleProfileFile(file: File) {
    setProfilePreview(URL.createObjectURL(file));
    setError('');
    uploadProfile.mutate(
      { organizacionId, file },
      { onError: () => { setError('No se pudo subir la imagen de perfil. Intentá de nuevo.'); setProfilePreview(null); } },
    );
  }

  function handleBannerFile(file: File) {
    setBannerPreview(URL.createObjectURL(file));
    setError('');
    uploadBanner.mutate(
      { organizacionId, file },
      { onError: () => { setError('No se pudo subir el banner. Intentá de nuevo.'); setBannerPreview(null); } },
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ImageDropZone
          label="Foto de perfil"
          aspect="square"
          currentSrc={imageUrl(profileImageKey)}
          preview={profilePreview}
          isUploading={uploadProfile.isPending}
          onFile={handleProfileFile}
        />
        <ImageDropZone
          label="Banner"
          aspect="banner"
          currentSrc={imageUrl(bannerKey)}
          preview={bannerPreview}
          isUploading={uploadBanner.isPending}
          onFile={handleBannerFile}
        />
      </div>
      {error && <Text variant="micro" color="urgent">{error}</Text>}
    </div>
  );
}
