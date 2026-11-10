import type { TestProject } from 'vitest/node';
import { BFF_URL, login, type CookieJar } from './client.js';

export interface Sessions {
  donante: CookieJar;
  admin: CookieJar;
  referente: CookieJar;
  referente2: CookieJar;
  referente3: CookieJar;
}

declare module 'vitest' {
  export interface ProvidedContext {
    sessions: Sessions;
  }
}

/**
 * Logs every seeded actor in exactly once per run (login is limited to 5/min per IP) and hands
 * the cookie jars to the test files, which run in separate module contexts.
 */
export default async function setup(project: TestProject) {
  const ready = await fetch(`${BFF_URL}/necesidades?size=1`).catch(() => null);
  if (!ready?.ok) {
    throw new Error(`BFF not reachable at ${BFF_URL}. Start the stack first: make up-local`);
  }
  const creds = {
    donante: ['donante@hornero.ar', 'Don123!'],
    admin: [process.env.E2E_ADMIN_EMAIL ?? 'admin@hornero.ar', process.env.E2E_ADMIN_PASSWORD ?? 'Admin123!'],
    referente: ['referente@hornero.ar', 'Ref123!'],
    referente2: ['referente2@hornero.ar', 'Ref123!'],
    referente3: ['referente3@hornero.ar', 'Ref123!'],
  } as const;
  const sessions = {} as Sessions;
  for (const [key, [email, password]] of Object.entries(creds)) {
    sessions[key as keyof Sessions] = (await login(email, password)).jar;
  }
  project.provide('sessions', sessions);
}
