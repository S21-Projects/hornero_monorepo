'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, TickCircle } from 'iconsax-reactjs';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';
import { DonateModal } from './donate-modal';

type DonateButtonVariant = 'primary' | 'secondary' | 'ghost';
type DonateButtonSize = 'default' | 'sm';

interface DonateButtonProps {
  necesidadId: number;
  necesidadDescripcion: string;
  orgNombre?: string;
  variant?: DonateButtonVariant;
  size?: DonateButtonSize;
  block?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}

export function DonateButton({
  necesidadId,
  necesidadDescripcion,
  orgNombre,
  variant = 'primary',
  size = 'sm',
  block,
  style,
  children,
}: DonateButtonProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [open, setOpen] = useState(false);
  const [donated, setDonated] = useState(false);

  // Referente / admin can't donate — hide the action entirely (UX only; the MS
  // also enforces hasRole('DONANTE')).
  if (isAuthenticated && user?.tipo !== 'DONANTE') return null;

  function handleClick() {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setOpen(true);
  }

  function handleDonated() {
    setDonated(true);
    setTimeout(() => setDonated(false), 2500);
  }

  return (
    <>
      <Button
        variant={donated ? 'ok' : variant}
        size={size}
        block={block}
        onClick={handleClick}
        disabled={donated}
        style={{ gap: 6, ...style }}
      >
        {donated ? (
          <>
            <TickCircle size={size === 'sm' ? 15 : 18} color="#fff" /> ¡Gracias!
          </>
        ) : (
          children ?? (
            <>
              <Heart size={size === 'sm' ? 15 : 18} color={variant === 'primary' ? '#fff' : 'var(--horn)'} /> Donar
            </>
          )
        )}
      </Button>
      {open && (
        <DonateModal
          necesidadId={necesidadId}
          necesidadDescripcion={necesidadDescripcion}
          orgNombre={orgNombre}
          onClose={() => setOpen(false)}
          onDonated={handleDonated}
        />
      )}
    </>
  );
}
