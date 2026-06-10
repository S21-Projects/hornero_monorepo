import { serverFetch } from '@/lib/serverFetch';
import { publicFetch } from '@/lib/publicFetch';
import type { OrganizacionResponse } from './organizaciones';

export async function getPendingOrganizaciones(): Promise<OrganizacionResponse[]> {
  // Uses serverFetch (authenticated): admin cookie required, no caching.
  return serverFetch<OrganizacionResponse[]>('/organizaciones/pendientes', {
    cache: 'no-store',
  });
}

export async function getValidatedOrganizaciones(): Promise<OrganizacionResponse[]> {
  // Uses publicFetch (unauthenticated): no cookies() call, so the home page
  // can statically generate with ISR (export const revalidate = 60 takes effect).
  return publicFetch<OrganizacionResponse[]>('/organizaciones', {
    revalidate: 60,
  });
}

export async function getOrganizacionBySlug(slug: string): Promise<OrganizacionResponse> {
  return publicFetch<OrganizacionResponse>(`/organizaciones/${slug}`, {
    revalidate: 60,
  });
}
