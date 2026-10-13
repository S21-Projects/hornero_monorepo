import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  const post = jest.fn();
  const http = { axiosRef: { post } } as unknown as HttpService;
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
});
