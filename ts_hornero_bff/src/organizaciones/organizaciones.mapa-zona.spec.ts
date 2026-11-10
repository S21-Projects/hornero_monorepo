import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { OrganizacionesController } from './organizaciones.controller';
import type { OrganizacionesService } from './organizaciones.service';

describe('OrganizacionesController mapaZona', () => {
  it('is public (the anonymous home reads it)', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const handler = OrganizacionesController.prototype.mapaZona;
    expect(new Reflector().get<boolean>(IS_PUBLIC_KEY, handler)).toBe(true);
  });

  it('forwards the four query params to the service', () => {
    const mapaZona = jest.fn().mockReturnValue('pins');
    const controller = new OrganizacionesController({
      mapaZona,
    } as unknown as OrganizacionesService);

    expect(controller.mapaZona('-35', '-34', '-59', '-58')).toBe('pins');
    expect(mapaZona).toHaveBeenCalledWith('-35', '-34', '-59', '-58');
  });

  it('listarTodas forwards the query params and the access token cookie', () => {
    const listarTodas = jest.fn().mockReturnValue('page');
    const controller = new OrganizacionesController({
      listarTodas,
    } as unknown as OrganizacionesService);
    const req = { cookies: { access_token: 'tok' } } as never;

    expect(
      controller.listarTodas(req, 'true', '1,2', 'sol', '1', '20', 'id,asc'),
    ).toBe('page');
    expect(listarTodas).toHaveBeenCalledWith('tok', {
      sinReferente: 'true',
      referenteIds: '1,2',
      q: 'sol',
      page: '1',
      size: '20',
      sort: 'id,asc',
    });
  });
});
