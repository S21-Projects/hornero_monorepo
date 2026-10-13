import { describe, it, expect } from 'vitest';
import { mapReclamoError } from './mapReclamoError';

const err = (status: number, message?: string) => ({ response: { status, data: { message } } });

describe('mapReclamoError', () => {
  it('tells the 409 rules apart by the MS reason', () => {
    expect(mapReclamoError(err(409, 'Ya tenés un reclamo pendiente para este comedor'))).toMatch(/reclamo pendiente/);
    expect(mapReclamoError(err(409, 'Alcanzaste el máximo de 3 organizaciones'))).toMatch(/tu cargo/);
    expect(mapReclamoError(err(409, 'Este comedor no está disponible para ser reclamado'))).toMatch(/ya no está disponible/);
    expect(mapReclamoError(err(409, 'El reclamo ya fue resuelto'))).toMatch(/ya fue resuelto/);
    expect(mapReclamoError(err(409, 'CONFLICTO_CONCURRENTE'))).toMatch(/al mismo tiempo/);
  });

  it('speaks to the admin about the claimant when the cap or inactivity blocks an approval', () => {
    expect(mapReclamoError(err(409, 'El referente ya alcanzó el máximo de 3 organizaciones'), 'admin')).toMatch(/su cargo/);
    expect(mapReclamoError(err(409, 'El referente está inactivo'), 'admin')).toMatch(/inactivo/);
  });

  it('maps the other statuses and falls back', () => {
    expect(mapReclamoError(err(400, 'EVIDENCIA_CLAVE_INVALIDA'))).toMatch(/evidencia/);
    expect(mapReclamoError(err(400))).toMatch(/Revisá/);
    expect(mapReclamoError(err(403))).toMatch(/permiso/);
    expect(mapReclamoError(err(404))).toMatch(/No encontramos/);
    expect(mapReclamoError(err(500))).toMatch(/Ocurrió un error/);
    expect(mapReclamoError(new Error('network'))).toMatch(/Ocurrió un error/);
  });
});
