import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { HttpService } from '@nestjs/axios';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { Role } from '../common/enums/role.enum';
import { ImagesService } from '../images/images.service';
import { UploadService } from '../upload/upload.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { ROLES_KEY } from './decorators/roles.decorator';

/**
 * Role matrix with the REAL `JwtAuthGuard` + `RolesGuard` (APP_GUARDs of `AppModule`) and the
 * REAL `JwtStrategy`. Only the outbound edges (MS over HTTP, S3) are stubbed. The matrix is
 * derived from the controllers' own `@Public` / `@Roles` metadata, so a route cannot be added,
 * or lose its decorator, without this suite noticing.
 */

const TEST_SECRET = 'role-matrix-test-secret';
process.env.JWT_SECRET = TEST_SECRET;
process.env.JAVA_MS_URL = 'http://ms.invalid';
process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

type Access = 'public' | 'any-authenticated' | Role[];
interface RouteEntry {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  label: string;
  access: Access;
}

/**
 * Pinned access policy, one line per route. It is deliberately hand-written: the live matrix is
 * read from the `@Public` / `@Roles` metadata, and this table is what that metadata must equal.
 * Adding a route, dropping a decorator or widening a role set fails the "policy" test until a
 * human updates the line. `any-authenticated` means a valid session and no particular role;
 * `GET /` is the Nest scaffold hello-world, which is not public.
 */
const EXPECTED_ACCESS: Record<string, Access> = {
  'DELETE /donaciones/:id': [Role.DONANTE],
  'DELETE /necesidades/:id': [Role.REFERENTE],
  'GET /': 'any-authenticated',
  'GET /articulos': 'public',
  'GET /auditoria/evidencias': [Role.ADMINISTRADOR],
  'GET /auth/me': 'any-authenticated',
  'GET /donaciones': 'public',
  'GET /donaciones/:id': 'public',
  'GET /donaciones/:id/asignaciones': [
    Role.DONANTE,
    Role.REFERENTE,
    Role.ADMINISTRADOR,
  ],
  'GET /donaciones/:id/entrega': [Role.DONANTE, Role.REFERENTE],
  'GET /donaciones/activas': [Role.ADMINISTRADOR],
  'GET /donaciones/mi-organizacion': [Role.REFERENTE],
  'GET /donaciones/mias': [Role.DONANTE],
  'GET /evidencia-files/:orgId/:filename': [Role.REFERENTE, Role.ADMINISTRADOR],
  'GET /images': 'public',
  'GET /necesidades': 'public',
  'GET /necesidades/:id': 'public',
  'GET /organizaciones': 'public',
  'GET /organizaciones/:id/acreditacion': [Role.ADMINISTRADOR, Role.REFERENTE],
  'GET /organizaciones/:id/acreditacion/evidencias': [Role.ADMINISTRADOR],
  'GET /organizaciones/:id/legajo': [Role.ADMINISTRADOR, Role.REFERENTE],
  'GET /organizaciones/:slug': 'public',
  'GET /organizaciones/mia': [Role.REFERENTE],
  'GET /organizaciones/pendientes': [Role.ADMINISTRADOR],
  'GET /organizaciones/todas': [Role.ADMINISTRADOR],
  'GET /rondas': [Role.ADMINISTRADOR],
  'GET /rondas/:id': [Role.ADMINISTRADOR],
  'GET /rondas/fondo': [Role.ADMINISTRADOR],
  'GET /usuarios': [Role.ADMINISTRADOR],
  'PATCH /articulos/:id/desactivar': [Role.ADMINISTRADOR],
  'PATCH /articulos/:id/reactivar': [Role.ADMINISTRADOR],
  'PATCH /donaciones/:id/decision': [Role.REFERENTE],
  'PATCH /donaciones/:id/estado': [Role.DONANTE],
  'PATCH /donaciones/:id/estado-admin': [Role.ADMINISTRADOR],
  'PATCH /necesidades/:id': [Role.REFERENTE],
  'PATCH /organizaciones/:id': [Role.REFERENTE],
  'PATCH /organizaciones/:id/acreditacion/evidencias/:evId/aprobar': [
    Role.ADMINISTRADOR,
  ],
  'PATCH /organizaciones/:id/acreditacion/evidencias/:evId/observar': [
    Role.ADMINISTRADOR,
  ],
  'PATCH /organizaciones/:id/acreditacion/nivel': [Role.ADMINISTRADOR],
  'PATCH /organizaciones/:id/info-publica': [Role.ADMINISTRADOR],
  'PATCH /organizaciones/:id/info-publica/aprobar': [Role.ADMINISTRADOR],
  'PATCH /organizaciones/:id/info-publica/rechazar': [Role.ADMINISTRADOR],
  'PATCH /organizaciones/:id/rechazar': [Role.ADMINISTRADOR],
  'PATCH /organizaciones/:id/referente': [Role.ADMINISTRADOR],
  'PATCH /organizaciones/:id/validar': [Role.ADMINISTRADOR],
  'PATCH /usuarios/:id/activo': [Role.ADMINISTRADOR],
  'POST /articulos': [Role.ADMINISTRADOR],
  'POST /auth/login': 'public',
  'POST /auth/logout': 'public',
  'POST /auth/refresh': 'public',
  'POST /auth/register': 'public',
  'POST /auth/resend-otp': 'public',
  'POST /auth/verify-otp': 'public',
  'POST /donaciones': [Role.DONANTE],
  'POST /donaciones/:id/entrega/codigo': [Role.DONANTE, Role.REFERENTE],
  'POST /donaciones/:id/entrega/verificar': [Role.DONANTE, Role.REFERENTE],
  'POST /necesidades': [Role.REFERENTE],
  'POST /organizaciones': [Role.REFERENTE],
  'POST /organizaciones/:id/acreditacion/evidencias': [Role.REFERENTE],
  'POST /rondas': [Role.ADMINISTRADOR],
  'POST /upload/org-banner/:id': [Role.REFERENTE, Role.ADMINISTRADOR],
  'POST /upload/org-evidencia/:id': [Role.REFERENTE, Role.ADMINISTRADOR],
  'POST /upload/org-profile/:id': [Role.REFERENTE, Role.ADMINISTRADOR],
  'PUT /articulos/:id': [Role.ADMINISTRADOR],
};

const HTTP_METHODS: Record<number, RouteEntry['method']> = {
  0: 'get',
  1: 'post',
  2: 'put',
  3: 'delete',
  4: 'patch',
};

const ALL_ROLES = Object.values(Role);

function joinPath(...parts: string[]): string {
  const joined = parts
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return `/${joined}`;
}

function discoverRoutes(app: INestApplication): RouteEntry[] {
  const reflector = app.get(Reflector);
  const routes: RouteEntry[] = [];
  const seen = new Set<unknown>();
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as (new () => object) | null;
      if (!controller || seen.has(controller)) continue;
      seen.add(controller);
      const base = (Reflect.getMetadata(PATH_METADATA, controller) ??
        '') as string;
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = (controller.prototype as Record<string, unknown>)[name];
        if (typeof handler !== 'function') continue;
        const verb = Reflect.getMetadata(METHOD_METADATA, handler) as
          | number
          | undefined;
        if (verb === undefined || !(verb in HTTP_METHODS)) continue;
        const sub = (Reflect.getMetadata(PATH_METADATA, handler) ??
          '') as string;
        const path = joinPath(base, sub);
        const targets = [handler, controller];
        const isPublic = reflector.getAllAndOverride<boolean>(
          IS_PUBLIC_KEY,
          targets,
        );
        const roles = reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
        const method = HTTP_METHODS[verb];
        const label = `${method.toUpperCase()} ${path}`;
        let access: Access;
        if (isPublic) access = 'public';
        else if (roles) access = roles;
        else access = 'any-authenticated';
        routes.push({ method, path, label, access });
      }
    }
  }
  return routes.sort((a, b) => a.label.localeCompare(b.label));
}

/** Concrete URL for a route pattern: every `:param` becomes `1`. */
const concretePath = (path: string) => path.replace(/:[^/]+/g, '1');

describe('BFF role matrix (real guards + real JwtStrategy)', () => {
  let app: INestApplication<App>;
  let routes: RouteEntry[];
  let signer: JwtService;

  const claims = (tipo: Role) => ({
    sub: '42',
    type: 'access',
    tipo,
    email: `${tipo.toLowerCase()}@example.org`,
    nombre: tipo,
    emailVerificado: true,
  });
  const token = (tipo: Role) =>
    signer.sign(claims(tipo), { secret: TEST_SECRET, expiresIn: '15m' });

  const call = (route: RouteEntry, accessToken?: string) => {
    const req = request(app.getHttpServer())[route.method](
      concretePath(route.path),
    );
    // A refresh_token cookie is always present so the public `/auth/refresh` handler does not
    // short-circuit with its own 401, which would mask the guard behaviour under test.
    const cookies = ['refresh_token=opaque'];
    if (accessToken) cookies.push(`access_token=${accessToken}`);
    req.set('Cookie', cookies);
    return req.send();
  };

  beforeAll(async () => {
    // Any HTTP call the services make resolves with an empty 200 instead of touching the network.
    const response = {
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    };
    // `then` must stay undefined or Nest would treat a stub as a thenable provider.
    const stub = (members: Record<string, unknown>, fallback: unknown) =>
      new Proxy(members, {
        get: (target, prop) =>
          prop === 'then' ? undefined : (target[prop as string] ?? fallback),
      });
    const axiosRef = stub({}, () => Promise.resolve(response));
    const httpStub = stub({ axiosRef }, () => of(response));
    const s3Stub = stub({}, () => Promise.resolve({}));

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(HttpService)
      .useValue(httpStub)
      .overrideProvider(UploadService)
      .useValue(s3Stub)
      .overrideProvider(ImagesService)
      .useValue(s3Stub)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { allowedOrigins: ['http://localhost:5173'] });
    await app.init();

    routes = discoverRoutes(app);
    signer = new JwtService();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('route inventory', () => {
    it('discovers the controllers routes', () => {
      expect(routes.length).toBeGreaterThan(30);
    });

    it('matches the pinned access policy exactly (no new, missing or widened route)', () => {
      const live = Object.fromEntries(routes.map((r) => [r.label, r.access]));
      expect(live).toEqual(EXPECTED_ACCESS);
    });
  });

  describe('anonymous', () => {
    it.each(['get', 'post', 'put', 'patch', 'delete'] as const)(
      'returns 401 on every protected %s route and never 401 on public ones',
      async (method) => {
        for (const route of routes.filter((r) => r.method === method)) {
          const res = await call(route);
          if (route.access === 'public') {
            expect([401, 403]).not.toContain(res.status);
          } else {
            expect({ route: route.label, status: res.status }).toEqual({
              route: route.label,
              status: 401,
            });
          }
        }
      },
    );
  });

  describe.each(ALL_ROLES)('as %s', (tipo) => {
    it('gets 403 on routes restricted to other roles and passes the guards on the rest', async () => {
      const jwt = token(tipo);
      const outcomes: Record<string, string> = {};
      const expected: Record<string, string> = {};
      for (const route of routes) {
        const allowed =
          route.access === 'public' ||
          route.access === 'any-authenticated' ||
          route.access.includes(tipo);
        expected[route.label] = allowed ? 'allowed' : '403';
        const res = await call(route, jwt);
        outcomes[route.label] = allowed
          ? [401, 403].includes(res.status)
            ? String(res.status)
            : 'allowed'
          : String(res.status);
      }
      expect(outcomes).toEqual(expected);
    });
  });

  describe('invalid access tokens', () => {
    // Every protected route must reject them, so the table is the protected subset.
    const protectedRoutes = () => routes.filter((r) => r.access !== 'public');

    const cases: Array<[string, () => string]> = [
      [
        'a refresh-type token in the access_token cookie',
        () =>
          signer.sign(
            { ...claims(Role.ADMINISTRADOR), type: 'refresh' },
            { secret: TEST_SECRET, expiresIn: '7d' },
          ),
      ],
      [
        'a token without the type claim',
        () => {
          const { type: _type, ...legacy } = claims(Role.ADMINISTRADOR);
          return signer.sign(legacy, {
            secret: TEST_SECRET,
            expiresIn: '15m',
          });
        },
      ],
      [
        'an expired token',
        () =>
          signer.sign(claims(Role.ADMINISTRADOR), {
            secret: TEST_SECRET,
            expiresIn: '-1s',
          }),
      ],
      [
        'a token signed with another secret',
        () =>
          signer.sign(claims(Role.ADMINISTRADOR), {
            secret: 'some-other-secret',
            expiresIn: '15m',
          }),
      ],
      ['a malformed token', () => 'not.a.jwt'],
    ];

    it.each(cases)(
      'rejects %s with 401 on every protected route',
      async (_n, build) => {
        const jwt = build();
        const statuses: Record<string, number> = {};
        for (const route of protectedRoutes()) {
          statuses[route.label] = (await call(route, jwt)).status;
        }
        expect(
          Object.fromEntries(
            Object.entries(statuses).filter(([, status]) => status !== 401),
          ),
        ).toEqual({});
      },
    );
  });
});
