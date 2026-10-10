import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { OrganizacionesController } from './organizaciones.controller';

/**
 * The BFF must mirror the MS `@PreAuthorize` rules on the organization write/own endpoints, so
 * a wrong-role caller is rejected at the BFF instead of relying on the MS alone.
 */
describe('OrganizacionesController roles metadata', () => {
  const reflector = new Reflector();
  const proto = OrganizacionesController.prototype;

  it.each([
    ['crear (POST /)', proto.crear],
    ['misOrganizaciones (GET /mia)', proto.misOrganizaciones],
    ['actualizar (PATCH /:id)', proto.actualizar],
  ])('%s is restricted to REFERENTE', (_name, handler) => {
    expect(reflector.get<Role[]>(ROLES_KEY, handler)).toEqual([Role.REFERENTE]);
  });
});
