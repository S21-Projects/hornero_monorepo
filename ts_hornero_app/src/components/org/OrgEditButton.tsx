'use client';

import { useState } from 'react';
import { Edit2 } from 'iconsax-reactjs';
import { useAuthStore } from '@/store/auth.store';
import { OrgEditForm } from './OrgEditForm';
import { type OrganizacionResponse } from '@/lib/api/organizaciones';

interface OrgEditButtonProps {
  org: OrganizacionResponse;
}

export function OrgEditButton({ org }: OrgEditButtonProps) {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);

  // Only the referente of the org can edit it
  if (!user || user.tipo !== 'REFERENTE') return null;
  if (org.referenteEmail && user.email !== org.referenteEmail) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Editar organización"
        style={{
          background: 'rgba(255,255,255,0.18)',
          border: '1.5px solid rgba(255,255,255,0.4)',
          borderRadius: 10,
          padding: '7px 10px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <Edit2 size={16} color="#fff" />
        Editar
      </button>

      {open && <OrgEditForm org={org} onClose={() => setOpen(false)} />}
    </>
  );
}
