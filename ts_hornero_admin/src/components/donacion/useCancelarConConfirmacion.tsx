import { useState } from 'react';
import type { ReactNode } from 'react';
import { useCancelarDonacion } from '../../lib/hooks/useCancelarDonacion';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface CancelarConConfirmacion {
  /** Opens the confirmation dialog. */
  pedir: () => void;
  /** The dialog to render once anywhere in the caller's tree. */
  dialogo: ReactNode;
  isPending: boolean;
  isError: boolean;
}

/**
 * Cancel-a-donación flow shared by "Mis donaciones" and the detail screen: confirm in a modal,
 * then run the mutation. Keeps the copy in one place.
 */
export function useCancelarConConfirmacion(donacionId: number): CancelarConConfirmacion {
  const cancelar = useCancelarDonacion();
  const [open, setOpen] = useState(false);
  const esEsta = cancelar.variables === donacionId;

  return {
    pedir: () => setOpen(true),
    isPending: cancelar.isPending && esEsta,
    isError: cancelar.isError && esEsta,
    dialogo: (
      <ConfirmDialog
        open={open}
        title="¿Cancelar esta donación?"
        description="La donación deja de ofrecerse y de asignarse a una necesidad. No se puede deshacer."
        confirmLabel="Sí, cancelar"
        cancelLabel="Volver"
        loading={cancelar.isPending && esEsta}
        onConfirm={() => cancelar.mutate(donacionId, { onSettled: () => setOpen(false) })}
        onCancel={() => setOpen(false)}
      />
    ),
  };
}
