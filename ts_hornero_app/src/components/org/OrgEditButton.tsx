'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { type OrganizacionResponse } from '@/lib/api/organizaciones';
import { useMyOrgQuery } from '@/hooks/useMyOrgQuery';
import { OrgEditForm } from './OrgEditForm';

interface OrgEditButtonProps {
  org: OrganizacionResponse;
}

export function OrgEditButton({ org }: OrgEditButtonProps) {
  const { data: myOrg } = useMyOrgQuery();
  const [isOpen, setIsOpen] = useState(false);

  if (myOrg?.id !== org.id) return null;

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        Editar
      </Button>
      {isOpen && (
        <OrgEditForm org={org} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
