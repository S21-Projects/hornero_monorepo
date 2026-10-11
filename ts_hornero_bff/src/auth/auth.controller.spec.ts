import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController.me (N9)', () => {
  const user = { userId: '7', email: 'a@b.c', tipo: 'DONANTE' };
  let authService: { verificarSesion: jest.Mock };
  let controller: AuthController;

  beforeEach(() => {
    authService = { verificarSesion: jest.fn().mockResolvedValue({}) };
    controller = new AuthController(authService as any);
  });

  it('confirms the user is still active at the MS, then returns the token payload', async () => {
    const req = { user, cookies: { access_token: 'tok' } };

    await expect(controller.me(req)).resolves.toBe(user);
    expect(authService.verificarSesion).toHaveBeenCalledWith('tok');
  });

  it('fails (and returns no user) when the MS refuses the session', async () => {
    const inactive = new Error('USUARIO_INACTIVO');
    authService.verificarSesion.mockRejectedValue(inactive);

    await expect(
      controller.me({ user, cookies: { access_token: 'tok' } }),
    ).rejects.toBe(inactive);
  });

  it('is unauthorized without an access_token cookie', async () => {
    await expect(controller.me({ user, cookies: {} })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
