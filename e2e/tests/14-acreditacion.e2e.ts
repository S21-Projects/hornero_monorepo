import { beforeAll, describe, expect, it } from 'vitest';
import {
  REQUISITOS_POR_NIVEL, actors, anonymous, cargarDeclaracion, marker, openNecesidades, retireOrg,
  subirEvidenciaPdf, type Actors, type Requisito,
} from '../src/fixtures.js';

/**
 * CU-07 (evidence upload), CU-08 (audit: approve and observe), CU-09 (level raise and its
 * rejections) and CU-10 (legajo export, the JSON the admin SPA renders and prints), plus the part
 * of RN-04 that is reachable through the API.
 *
 * One fresh organizacion of referente3 walks the whole ladder N0 -> N3, so the file also leaves a
 * legajo with every kind of event. The organizacion is stepped back down and retired at the end
 * (the 3-organizacion cap must stay free for the next run).
 *
 * Not reachable end to end: the daily job that persists VENCIDA and the 30-day grace window are
 * time-driven (no endpoint, no clock injection), and the legajo PDF is rendered by the browser
 * (`legajo.tsx` prints the page); only the data behind it is asserted here.
 */
describe('P5. accreditation: evidence, audit, levels and legajo', () => {
  let a: Actors;
  let orgId: number;
  let articuloFrioId: number;
  const path = (suffix: string) => `/organizaciones/${orgId}/${suffix}`;

  /** Every evidence row of the organizacion, as the admin audit view sees it. */
  const evidencias = async (estado?: string) => {
    const res = await a.admin.get(path(`acreditacion/evidencias${estado ? `?estado=${estado}` : ''}`));
    expect(res.status).toBe(200);
    return res.data as any[];
  };
  const vigente = async (requisito: Requisito) => {
    const rows = (await evidencias()).filter((e) => e.requisito === requisito && e.estado !== 'REEMPLAZADA');
    expect(rows, `no live evidence for ${requisito}`).toHaveLength(1);
    return rows[0];
  };
  const cargar = async (requisito: Requisito, extra: Record<string, unknown> = {}) => {
    const res = await cargarDeclaracion(a.referente3, orgId, requisito, marker(`declara ${requisito}`), extra);
    expect(res.status).toBe(201);
    return res.data as { id: number; estado: string };
  };
  const aprobar = async (evId: number) => {
    const res = await a.admin.patch(path(`acreditacion/evidencias/${evId}/aprobar`));
    expect(res.status).toBe(200);
    return res.data;
  };
  /** Submits and approves a requisito in one go. */
  const acreditar = async (requisito: Requisito) => aprobar((await cargar(requisito)).id);
  const nivel = async () => (await a.referente3.get(path('acreditacion'))).data.nivel as string;
  const cambiarNivel = (destino: string, motivo = marker(`to ${destino}`)) =>
    a.admin.patch(path('acreditacion/nivel'), { destino, motivo });

  beforeAll(async () => {
    a = actors();
    // Retire organizaciones of earlier aborted runs (stepping down level by level first).
    const mine = ((await a.referente3.get('/organizaciones/mia')).data ?? []) as any[];
    for (const org of mine) {
      if (typeof org.nombre !== 'string' || !org.nombre.startsWith('e2e ') || org.estado === 'RECHAZADA') continue;
      for (const destino of ['N2', 'N1']) {
        await a.admin.patch(`/organizaciones/${org.id}/acreditacion/nivel`, { destino, motivo: 'e2e cleanup' });
      }
      await retireOrg(a.admin, org.id);
    }
    const org = await a.referente3.post('/organizaciones', {
      nombre: marker('org-acreditacion'), tipo: 'OTRO', latitud: -31.4, longitud: -64.19,
    });
    expect(org.status).toBe(201);
    orgId = org.data.id;
  }, 60_000);

  describe('CU-07. evidence upload', () => {
    let key: string;
    let filename: string;
    let primera: number;

    it('a new organizacion starts at N0', async () => {
      expect(await nivel()).toBe('N0');
    });

    it('the owner uploads a PDF and gets an organizacion-scoped object key', async () => {
      key = await subirEvidenciaPdf(a.referente3, orgId, 'Constancia ficticia e2e');
      expect(key).toMatch(new RegExp(`^org-evidencia/${orgId}/[\\w-]+\\.pdf$`));
      filename = key.split('/').pop()!;
    });

    it('rejects an upload whose bytes are not an allowed type, whatever the declared mimetype', async () => {
      const res = await a.referente3.upload(`/upload/org-evidencia/${orgId}`, 'image', {
        bytes: new TextEncoder().encode('this is not a pdf'), name: 'x.pdf', type: 'application/pdf',
      });
      expect(res.status).toBe(400);
    });

    it('rejects a disallowed declared mimetype (webp) with 400', async () => {
      const res = await a.referente3.upload(`/upload/org-evidencia/${orgId}`, 'image', {
        bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), name: 'x.webp', type: 'image/webp',
      });
      expect(res.status).toBe(400);
    });

    it('another referente and a donante cannot upload evidence for this organizacion', async () => {
      const bytes = { bytes: new TextEncoder().encode('%PDF-1.4 x'), name: 'x.pdf', type: 'application/pdf' };
      expect((await a.referente2.upload(`/upload/org-evidencia/${orgId}`, 'image', bytes)).status).toBe(403);
      expect((await a.donante.upload(`/upload/org-evidencia/${orgId}`, 'image', bytes)).status).toBe(403);
      expect((await anonymous().upload(`/upload/org-evidencia/${orgId}`, 'image', bytes)).status).toBe(401);
    });

    it('submits the file as DOCUMENTO evidence -> 201 PENDIENTE with the key stored', async () => {
      const res = await a.referente3.post(path('acreditacion/evidencias'), {
        requisito: 'SERVICIO_REGULAR_GRATUITO', tipoEvidencia: 'DOCUMENTO', objectKey: key,
        declaracion: marker('constancia'),
      });
      expect(res.status).toBe(201);
      expect(res.data.estado).toBe('PENDIENTE');
      expect(res.data.objectKey).toBe(key);
      primera = res.data.id;
    });

    it('refuses an object key on a DECLARACION and an invalid requisito', async () => {
      const withKey = await cargarDeclaracion(a.referente3, orgId, 'NO_DISCRIMINACION', 'x', { objectKey: key });
      expect(withKey.status).toBe(400);
      const bad = await a.referente3.post(path('acreditacion/evidencias'), {
        requisito: 'NO_EXISTE', tipoEvidencia: 'DECLARACION', declaracion: 'x',
      });
      expect(bad.status).toBe(400);
    });

    it('only the owner submits: other referente 403, donante 403, admin 403', async () => {
      const body = { requisito: 'NO_DISCRIMINACION', tipoEvidencia: 'DECLARACION', declaracion: 'x' };
      expect((await a.referente2.post(path('acreditacion/evidencias'), body)).status).toBe(403);
      expect((await a.donante.post(path('acreditacion/evidencias'), body)).status).toBe(403);
      expect((await a.admin.post(path('acreditacion/evidencias'), body)).status).toBe(403);
    });

    it('the file is served to the owner and to an admin only, as an attachment', async () => {
      const file = `/evidencia-files/${orgId}/${filename}`;
      for (const who of [a.referente3, a.admin]) {
        const res = await who.get(file);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/pdf');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['content-disposition']).toContain('attachment');
        expect(res.headers['cache-control']).toContain('no-store');
      }
      expect((await a.referente2.get(file)).status).toBe(403);
      expect((await a.donante.get(file)).status).toBe(403);
      expect((await anonymous().get(file)).status).toBe(401);
      // A syntactically valid key with no evidence row behind it is not served either.
      expect((await a.admin.get(`/evidencia-files/${orgId}/00000000-0000-0000-0000-000000000000.pdf`)).status).toBe(404);
    });

    it('resubmitting the same requisito replaces the previous row without deleting it', async () => {
      const segunda = await a.referente3.post(path('acreditacion/evidencias'), {
        requisito: 'SERVICIO_REGULAR_GRATUITO', tipoEvidencia: 'DECLARACION', declaracion: marker('declaracion'),
      });
      expect(segunda.status).toBe(201);
      const rows = (await evidencias()).filter((e) => e.requisito === 'SERVICIO_REGULAR_GRATUITO');
      expect(rows.find((e) => e.id === primera)?.estado).toBe('REEMPLAZADA');
      expect(rows.find((e) => e.id === segunda.data.id)?.estado).toBe('PENDIENTE');
    });
  });

  describe('CU-08. audit: approve and observe', () => {
    it('the pending evidence shows up in the global audit queue with its organizacion', async () => {
      const res = await a.admin.get('/auditoria/evidencias?size=100&sort=cargadoEn,desc');
      expect(res.status).toBe(200);
      const mine = (res.data.content as any[]).filter((e) => e.organizacionId === orgId);
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((e) => e.estado === 'PENDIENTE')).toBe(true);
      expect(mine[0].organizacionNombre).toContain('org-acreditacion');
    });

    it('only an admin audits: referente and donante get 403 on the queue and on approve/observe', async () => {
      const row = await vigente('SERVICIO_REGULAR_GRATUITO');
      expect((await a.referente3.get('/auditoria/evidencias')).status).toBe(403);
      expect((await a.donante.get('/auditoria/evidencias')).status).toBe(403);
      expect((await a.referente3.patch(path(`acreditacion/evidencias/${row.id}/aprobar`))).status).toBe(403);
      expect((await a.referente3.patch(path(`acreditacion/evidencias/${row.id}/observar`), { observacion: 'x' })).status).toBe(403);
    });

    it('observe: the reason is stored, kept on the row and visible to the owner in the legajo', async () => {
      const row = await vigente('SERVICIO_REGULAR_GRATUITO');
      const observacion = marker('falta el horario de atencion');
      const res = await a.admin.patch(path(`acreditacion/evidencias/${row.id}/observar`), { observacion });
      expect(res.status).toBe(200);
      expect(res.data.estado).toBe('OBSERVADA');
      expect(res.data.observacion).toBe(observacion);
      expect(res.data.revisadoPor).toBeTruthy();

      const legajo = (await a.referente3.get(path('legajo'))).data;
      const req = legajo.requisitos.find((r: any) => r.requisito === 'SERVICIO_REGULAR_GRATUITO');
      expect(req.estado).toBe('OBSERVADA');
      expect(req.observacion).toBe(observacion);
    });

    it('an observed requisito does not count: the owner fixes it, a new submission is approved', async () => {
      const nueva = await cargar('SERVICIO_REGULAR_GRATUITO');
      const rows = (await evidencias()).filter((e) => e.requisito === 'SERVICIO_REGULAR_GRATUITO');
      expect(rows.find((e) => e.estado === 'OBSERVADA')).toBeUndefined();
      expect(rows.filter((e) => e.estado === 'REEMPLAZADA')).toHaveLength(2);

      const aprobada = await aprobar(nueva.id);
      expect(aprobada.estado).toBe('APROBADA');
      expect(aprobada.revisadoPor).toBeTruthy();
      expect(aprobada.revisadoEn).toBeTruthy();
    });

    it('RN-04: approval stamps a validity of about one year from today', async () => {
      const row = await vigente('SERVICIO_REGULAR_GRATUITO');
      const days = (Date.parse(row.validoHasta) - Date.now()) / 86_400_000;
      expect(row.expirada).toBe(false);
      expect(days).toBeGreaterThan(360);
      expect(days).toBeLessThan(368);
    });

    it('approving or observing an unknown evidence id is 404', async () => {
      expect((await a.admin.patch(path('acreditacion/evidencias/999999999/aprobar'))).status).toBe(404);
      expect((await a.admin.patch(path('acreditacion/evidencias/999999999/observar'), { observacion: 'x' })).status).toBe(404);
    });
  });

  describe('CU-09. raising and lowering the level', () => {
    it('is refused (409) while requisitos are missing, and the level does not change', async () => {
      const res = await cambiarNivel('N1');
      expect(res.status).toBe(409);
      expect(await nivel()).toBe('N0');
    });

    it('is refused with 403 for a referente or a donante, and 400 without a motivo', async () => {
      expect((await a.referente3.patch(path('acreditacion/nivel'), { destino: 'N1', motivo: 'x' })).status).toBe(403);
      expect((await a.donante.patch(path('acreditacion/nivel'), { destino: 'N1', motivo: 'x' })).status).toBe(403);
      expect((await a.admin.patch(path('acreditacion/nivel'), { destino: 'N1' })).status).toBe(400);
      expect((await a.admin.patch(path('acreditacion/nivel'), { destino: 'N9', motivo: 'x' })).status).toBe(400);
    });

    it('with all N1 requisitos approved, N0 -> N1 works and the organizacion becomes APROBADA', async () => {
      await acreditar('NO_DISCRIMINACION');
      // The first requisito is already approved by CU-08; N1 is still one short.
      expect((await cambiarNivel('N1')).status).toBe(409);
      await acreditar('SEDE_INSCRIPTA_INDIVIDUALMENTE');
      const res = await cambiarNivel('N1');
      expect(res.status).toBe(200);
      expect(await nivel()).toBe('N1');
      const mia = ((await a.referente3.get('/organizaciones/mia')).data as any[]).find((o) => o.id === orgId);
      expect(mia.estado).toBe('APROBADA');
    });

    it('the categories open to the organizacion follow its level: REFRIGERADO needs N2 (409 at N1)', async () => {
      const articulos = (await openNecesidades()).flatMap((n) => n.articulos);
      const seco = articulos.find((x) => x.categoria === 'NO_PERECEDERO');
      const frio = articulos.find((x) => x.categoria === 'REFRIGERADO');
      expect(seco && frio, 'seed data lacks a NO_PERECEDERO and a REFRIGERADO articulo').toBeTruthy();
      const publicar = (articuloId: number, label: string) => a.referente3.post('/necesidades', {
        descripcion: marker(label), prioridad: 'NORMAL', organizacionId: orgId, articuloIds: [articuloId],
      });

      expect((await publicar(seco!.id, 'necesidad-seca')).status).toBe(201);
      const rechazada = await publicar(frio!.id, 'necesidad-fria');
      expect(rechazada.status).toBe(409);
      expect(JSON.stringify(rechazada.body)).toContain('REFRIGERADO');
      expect(JSON.stringify(rechazada.body)).toContain('N2');
      articuloFrioId = frio!.id; // reused once the level is N2
    });

    it('N1 -> N2 is refused (409) while one N2 requisito is missing or only pending', async () => {
      const [c1, c2, c3] = REQUISITOS_POR_NIVEL.N2;
      await acreditar(c1);
      await acreditar(c2);
      expect((await cambiarNivel('N2')).status).toBe(409);
      await cargar(c3); // submitted but not audited
      expect((await cambiarNivel('N2')).status).toBe(409);
      expect(await nivel()).toBe('N1');
    });

    it('skipping a level is refused (400 invalid transition) once the requisitos are complete', async () => {
      await aprobar((await vigente(REQUISITOS_POR_NIVEL.N2[2])).id);
      for (const r of REQUISITOS_POR_NIVEL.N3) await acreditar(r);
      // Every requisito up to N3 is approved, so completeness is not the obstacle: only the ladder.
      const skip = await cambiarNivel('N3');
      expect(skip.status).toBe(400);
      expect(JSON.stringify(skip.body)).toContain('Invalid state transition');
      expect(await nivel()).toBe('N1');
    });

    it('climbs one level at a time: N1 -> N2 -> N3', async () => {
      expect((await cambiarNivel('N2')).status).toBe(200);
      expect(await nivel()).toBe('N2');
      expect((await cambiarNivel('N3')).status).toBe(200);
      expect(await nivel()).toBe('N3');
    });

    it('with the level at N2, a REFRIGERADO necesidad is accepted', async () => {
      expect((await cambiarNivel('N2', marker('down to N2'))).status).toBe(200);
      const res = await a.referente3.post('/necesidades', {
        descripcion: marker('necesidad-fria'), prioridad: 'NORMAL', organizacionId: orgId,
        articuloIds: [articuloFrioId],
      });
      expect(res.status).toBe(201);
    });

    it('lowering needs a motivo and also moves one level at a time (N2 -> N0 is refused)', async () => {
      expect((await a.admin.patch(path('acreditacion/nivel'), { destino: 'N1', motivo: '' })).status).toBe(400);
      const skip = await cambiarNivel('N0');
      expect(skip.status).toBe(400);
      expect(await nivel()).toBe('N2');
    });

    it('RN-04: an approved requisito that is already expired blocks the next raise (409)', async () => {
      // The referente states a validity that ended yesterday; approval keeps the earlier date.
      const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const antes = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
      const nueva = await cargar('PERSONERIA_JURIDICA_O_AVAL', { validoDesde: antes, validoHasta: ayer });
      const aprobada = await aprobar(nueva.id);
      expect(aprobada.validoHasta).toBe(ayer);
      expect(aprobada.expirada).toBe(true);

      const res = await cambiarNivel('N3');
      expect(res.status).toBe(409);
      expect(await nivel()).toBe('N2');

      const legajo = (await a.admin.get(path('legajo'))).data;
      const req = legajo.requisitos.find((r: any) => r.requisito === 'PERSONERIA_JURIDICA_O_AVAL');
      expect(req.expirada).toBe(true);
      expect(req.graciaHasta).toBeTruthy();
    });

    it('once the expired requisito is replaced and approved, the raise works again', async () => {
      await acreditar('PERSONERIA_JURIDICA_O_AVAL');
      expect((await cambiarNivel('N3')).status).toBe(200);
      expect(await nivel()).toBe('N3');
    });
  });

  describe('CU-10. legajo export', () => {
    let legajo: any;

    it('the owner and any admin read the legajo (200); another referente, a donante and anonymous cannot', async () => {
      const own = await a.referente3.get(path('legajo'));
      expect(own.status).toBe(200);
      legajo = (await a.admin.get(path('legajo'))).data;
      expect(legajo).toBeTruthy();
      expect((await a.referente2.get(path('legajo'))).status).toBe(403);
      expect((await a.donante.get(path('legajo'))).status).toBe(403);
      expect((await anonymous().get(path('legajo'))).status).toBe(401);
    });

    it('carries the organizacion, its current level, the server-owned disclosure and all 8 requisitos', () => {
      expect(legajo.organizacionId).toBe(orgId);
      expect(legajo.nivel).toBe('N3');
      expect(legajo.nivelDesde).toBeTruthy();
      expect(legajo.disclosure).toContain('No constituye una verificación del sistema');
      const names = legajo.requisitos.map((r: any) => r.requisito).sort();
      expect(names).toEqual([...REQUISITOS_POR_NIVEL.N1, ...REQUISITOS_POR_NIVEL.N2, ...REQUISITOS_POR_NIVEL.N3].sort());
      expect(legajo.requisitos.every((r: any) => r.estado === 'APROBADA')).toBe(true);
    });

    it('carries the compliance history; an organizacion with no resolved donations has a null rate', () => {
      expect(legajo.cumplimiento).toEqual({ entregadas: 0, rechazadas: 0, tasa: null });
    });

    it('lists the full chronological event log, from registration through the last level change', () => {
      const tipos = legajo.eventos.map((e: any) => e.tipo);
      expect(tipos[0]).toBe('ORGANIZACION_REGISTRADA');
      for (const t of ['EVIDENCIA_ADJUNTADA', 'EVIDENCIA_REEMPLAZADA', 'REQUISITO_OBSERVADO', 'REQUISITO_APROBADO', 'NIVEL_ELEVADO', 'NIVEL_REDUCIDO']) {
        expect(tipos, t).toContain(t);
      }
      expect(tipos[tipos.length - 1]).toBe('NIVEL_ELEVADO');
      const times = legajo.eventos.map((e: any) => Date.parse(e.ocurridoEn));
      expect(times).toEqual([...times].sort((x, y) => x - y));
      // The level history in the log ends where the stored level is.
      const niveles = legajo.eventos.filter((e: any) => e.nivelDespues).map((e: any) => e.nivelDespues);
      expect(niveles[niveles.length - 1]).toBe(legajo.nivel);
    });

    it('attributes each audit event to an actor type; the owner sees the same log as the admin', async () => {
      const own = (await a.referente3.get(path('legajo'))).data;
      expect(own.eventos).toHaveLength(legajo.eventos.length);
      const aprobaciones = legajo.eventos.filter((e: any) => e.tipo === 'REQUISITO_APROBADO');
      expect(aprobaciones.length).toBeGreaterThanOrEqual(8);
      expect(aprobaciones.every((e: any) => e.actorTipo === 'ADMINISTRADOR')).toBe(true);
      expect(legajo.requisitos.every((r: any) => r.auditorNombre && r.auditadoEn)).toBe(true);
    });

    it('is 404 for an unknown organizacion', async () => {
      expect((await a.admin.get('/organizaciones/999999999/legajo')).status).toBe(404);
    });
  });

  it('cleanup: steps the organizacion down and retires it (frees the referente cap)', async () => {
    for (const destino of ['N2', 'N1']) {
      expect((await cambiarNivel(destino, marker('cleanup'))).status).toBe(200);
    }
    await retireOrg(a.admin, orgId);
    const mia = ((await a.referente3.get('/organizaciones/mia')).data as any[]).find((o) => o.id === orgId);
    expect(mia.estado).toBe('RECHAZADA');
  });
});
