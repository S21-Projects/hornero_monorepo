'use client';

import { useState, type FormEvent } from 'react';
import { Heart } from 'iconsax-reactjs';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { useCrearDonacion } from '@/lib/hooks/useCrearDonacion';

interface DonateModalProps {
  necesidadId: number;
  necesidadDescripcion: string;
  orgNombre?: string;
  onClose: () => void;
  onDonated?: () => void;
}

const MAX_OBSERVACIONES = 1000;

export function DonateModal({
  necesidadId,
  necesidadDescripcion,
  orgNombre,
  onClose,
  onDonated,
}: DonateModalProps) {
  const { mutate, isPending } = useCrearDonacion();
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    mutate(
      {
        necesidadId,
        ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
      },
      {
        onSuccess: () => {
          onDonated?.();
          onClose();
        },
        onError: () => {
          setError('No se pudo registrar la donación. Intentá de nuevo.');
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--r-card)',
          padding: 32,
          width: '100%',
          maxWidth: 460,
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <Text variant="h3" as="h2">Donar</Text>
            <Text variant="body-sm" color="ink-2" style={{ marginTop: 4 }}>
              {orgNombre ? `Para ${orgNombre}` : 'Para esta necesidad'}
            </Text>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1 }}
            aria-label="Cerrar"
          >
            <Text variant="body" color="ink-3">✕</Text>
          </button>
        </div>

        <div
          style={{
            background: 'var(--card-2)',
            borderRadius: 12,
            padding: '12px 14px',
          }}
        >
          <Text as="div" variant="caption" color="ink-3" style={{ marginBottom: 4 }}>
            Necesidad
          </Text>
          <Text as="div" variant="body-sm">{necesidadDescripcion}</Text>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Text as="label" variant="label" color="ink-2">
              ¿Qué querés ofrecer? (opcional)
            </Text>
            <textarea
              value={observaciones}
              maxLength={MAX_OBSERVACIONES}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={4}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 14,
                fontWeight: 600,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              placeholder="Ej: 10 kg de arroz, 5 frazadas, etc."
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
            <Button type="submit" variant="primary" block loading={isPending} style={{ gap: 8 }}>
              <Heart size={18} color="#fff" /> Confirmar donación
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
