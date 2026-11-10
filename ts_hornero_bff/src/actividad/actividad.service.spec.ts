import { ActividadService } from './actividad.service';

describe('ActividadService', () => {
  const get = jest.fn();
  const http = { axiosRef: { get } };
  const config = { get: jest.fn().mockReturnValue('http://ms.test:8081') };
  let service: ActividadService;

  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { content: [] } });
    service = new ActividadService(http as any, config as any);
  });

  it('forwards every filter as an encoded query string with the bearer token', async () => {
    const out = await service.listar('tok', {
      page: '1',
      size: '20',
      actorUsuarioId: '3',
      accion: 'LOGIN',
      resultado: 'FALLO',
      entidadTipo: 'USUARIO',
      entidadId: '7',
      desde: '2026-10-01T00:00:00Z',
      hasta: '2026-10-02T00:00:00Z',
    });

    expect(out).toEqual({ content: [] });
    const [url, opts] = get.mock.calls[0];
    expect(url).toContain('http://ms.test:8081/api/actividad?');
    const qs = new URL(url).searchParams;
    expect(qs.get('accion')).toBe('LOGIN');
    expect(qs.get('resultado')).toBe('FALLO');
    expect(qs.get('actorUsuarioId')).toBe('3');
    expect(qs.get('entidadTipo')).toBe('USUARIO');
    expect(qs.get('entidadId')).toBe('7');
    expect(qs.get('desde')).toBe('2026-10-01T00:00:00Z');
    expect(qs.get('page')).toBe('1');
    expect(opts.headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('omits empty filters', async () => {
    await service.listar('tok', { accion: '', page: undefined });
    expect(get.mock.calls[0][0]).toBe('http://ms.test:8081/api/actividad');
  });

  it('does not let a value split the query string', async () => {
    await service.listar('tok', { entidadTipo: 'X&actorUsuarioId=1' });
    const qs = new URL(get.mock.calls[0][0]).searchParams;
    expect(qs.get('actorUsuarioId')).toBeNull();
  });
});
