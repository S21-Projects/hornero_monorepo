import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  const post = jest.fn();
  const get = jest.fn();
  const http = { axiosRef: { post, get } } as unknown as HttpService;
  const config = {
    get: () => 'http://ms.test',
  } as unknown as ConfigService;
  const service = new UsuariosService(http, config);

  it('anonimizar POSTs to the MS with the bearer token and returns the body', async () => {
    post.mockResolvedValue({ data: { id: 7, nombre: 'Usuario eliminado' } });

    const res = await service.anonimizar(7, 'tok');

    expect(post).toHaveBeenCalledWith(
      'http://ms.test/api/usuarios/7/anonimizar',
      {},
      { headers: { Authorization: 'Bearer tok' } },
    );
    expect(res).toEqual({ id: 7, nombre: 'Usuario eliminado' });
  });

  describe('findAll', () => {
    it('GETs the MS list with the bearer token and no query when no filter is given', async () => {
      get.mockResolvedValue({ data: { content: [] } });

      const res = await service.findAll('tok');

      expect(get).toHaveBeenCalledWith('http://ms.test/api/usuarios', {
        headers: { Authorization: 'Bearer tok' },
      });
      expect(res).toEqual({ content: [] });
    });

    it('forwards tipo, activo, q and paging, percent-encoding the search text', async () => {
      get.mockResolvedValue({ data: {} });

      await service.findAll('tok', {
        tipo: 'REFERENTE',
        activo: 'true',
        q: 'ana&x=1',
        page: '2',
        size: '20',
        sort: 'id,asc',
      });

      expect(get).toHaveBeenCalledWith(
        'http://ms.test/api/usuarios?tipo=REFERENTE&activo=true&q=ana%26x%3D1&page=2&size=20&sort=id%2Casc',
        { headers: { Authorization: 'Bearer tok' } },
      );
    });
  });
});
