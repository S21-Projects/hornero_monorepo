import { describe, it, expect } from 'vitest';
import { mapReporteError } from './mapReporteError';

const err = (status: number, message?: string) => ({ response: { status, data: { message } } });

describe('mapReporteError', () => {
  it('tells the 409 rules apart by the MS reason', () => {
    expect(mapReporteError(err(409, 'Ya tenés un reporte pendiente para este comedor'))).toMatch(/reporte pendiente/);
    expect(mapReporteError(err(409, 'Este comedor no se puede reportar'))).toMatch(/ya no se puede reportar/);
    expect(mapReporteError(err(409, 'El reporte ya fue resuelto'))).toMatch(/ya fue resuelto/);
    expect(mapReporteError(err(409, 'CONFLICTO_CONCURRENTE'))).toMatch(/al mismo tiempo/);
    expect(mapReporteError(err(409, 'Este comedor ya no está sin reclamar'), 'admin')).toMatch(/descartá el reporte/);
  });

  it('explains the spam caps and the verified-email gate', () => {
    expect(mapReporteError(err(409, 'LIMITE_REPORTES_PENDIENTES'))).toMatch(/muchos reportes en revisión/);
    expect(mapReporteError(err(429, 'DEMASIADOS_REPORTES'))).toMatch(/demasiados reportes/);
    expect(mapReporteError(err(403, 'EMAIL_NO_VERIFICADO'))).toMatch(/Verificá tu email/);
  });

  it('maps the other statuses and falls back', () => {
    expect(mapReporteError(err(400))).toMatch(/Revisá los datos/);
    expect(mapReporteError(err(400), 'admin')).toMatch(/nota/);
    expect(mapReporteError(err(403))).toMatch(/permiso/);
    expect(mapReporteError(err(404))).toMatch(/No encontramos/);
    expect(mapReporteError(new Error('x'))).toMatch(/Ocurrió un error/);
  });
});
