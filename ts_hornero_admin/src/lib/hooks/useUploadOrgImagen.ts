import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';

interface UploadVariables {
  organizacionId: number;
  file: File;
}

/**
 * Shared upload mutation for both org-profile and org-banner. The BFF
 * persists the resulting S3 key server-side as part of the same request
 * (referente-owned orgs write through PATCH /organizaciones/:id, admin
 * uploads on any org write through the admin-only info-pública endpoint) —
 * there's no separate "save" step on the frontend.
 */
function useUploadOrgImagen(endpoint: 'org-profile' | 'org-banner' | 'org-evidencia') {
  const queryClient = useQueryClient();

  return useMutation<{ key: string }, Error, UploadVariables>({
    mutationFn: ({ organizacionId, file }) => {
      const formData = new FormData();
      formData.append('image', file);
      return api
        .post<{ key: string }>(`/upload/${endpoint}/${organizacionId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizaciones'] });
    },
  });
}

export function useUploadOrgProfile() {
  return useUploadOrgImagen('org-profile');
}

export function useUploadOrgBanner() {
  return useUploadOrgImagen('org-banner');
}

/**
 * Accreditation evidence file upload (`POST upload/org-evidencia/:id`, owning referente or
 * admin). Unlike profile/banner, the resulting key is never persisted server-side by this call —
 * it flows into `EvidenciaForm`'s own `cargarEvidencia` submission as `objectKey`.
 */
export function useUploadOrgEvidencia() {
  return useUploadOrgImagen('org-evidencia');
}
