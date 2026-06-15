import { api } from '@/lib/axios';

export type UploadTarget = 'org-profile' | 'org-banner' | 'user-photo';
export type AllowedContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
}

export function getContentType(filename: string): AllowedContentType | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return null;
}

export async function getPresignUrl(
  type: UploadTarget,
  filename: string,
  contentType: AllowedContentType,
  entityId?: number,
): Promise<PresignResponse> {
  const params = new URLSearchParams({
    type,
    filename,
    contentType,
    ...(entityId != null ? { entityId: String(entityId) } : {}),
  });
  const { data } = await api.get<PresignResponse>(`/upload/presign?${params.toString()}`);
  return data;
}
