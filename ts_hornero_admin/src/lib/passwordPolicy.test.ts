import { describe, it, expect } from 'vitest';
import {
  PASSWORD_HINT,
  validatePasswordLength,
  passwordErrorFromResponse,
} from './passwordPolicy';

describe('validatePasswordLength', () => {
  it('rejects fewer than 15 characters', () => {
    expect(validatePasswordLength('a'.repeat(14))).toMatch(/al menos 15/);
  });

  it('accepts 15 and 64 characters, spaces included', () => {
    expect(validatePasswordLength('a'.repeat(15))).toBeUndefined();
    expect(validatePasswordLength('a'.repeat(64))).toBeUndefined();
    expect(validatePasswordLength('la cafetera azul canta')).toBeUndefined();
  });

  it('rejects more than 64 characters', () => {
    expect(validatePasswordLength('a'.repeat(65))).toMatch(/más de 64/);
  });

  it('counts code points, not UTF-16 units', () => {
    expect(validatePasswordLength('😀'.repeat(15))).toBeUndefined();
    expect(validatePasswordLength('😀'.repeat(14))).toMatch(/al menos 15/);
  });

  it('rejects more than 72 UTF-8 bytes even under 64 characters', () => {
    expect(validatePasswordLength('ñ'.repeat(40) + 'a'.repeat(20))).toMatch(/demasiado larga/);
  });

  it('applies no composition rules', () => {
    expect(validatePasswordLength('zebrafluviomontana')).toBeUndefined();
  });
});

describe('passwordErrorFromResponse', () => {
  const resp = (message: unknown, errors?: unknown) => ({ response: { status: 400, data: { message, errors } } });

  it.each([
    ['PASSWORD_DEMASIADO_CORTA', /al menos 15/],
    ['PASSWORD_DEMASIADO_LARGA', /demasiado larga|más de 64/],
    ['PASSWORD_COMUN', /demasiado común|predecible/],
    ['PASSWORD_CONTIENE_DATOS_PERSONALES', /nombre, tu email|datos personales/],
  ])('maps %s to Spanish copy', (code, expected) => {
    expect(passwordErrorFromResponse(resp(code))).toMatch(expected);
  });

  it('finds the code when the message is an array', () => {
    expect(passwordErrorFromResponse(resp(['PASSWORD_COMUN']))).toMatch(/común|predecible/);
  });

  it('finds the code in errors[]', () => {
    expect(passwordErrorFromResponse(resp('Datos inválidos', ['PASSWORD_COMUN']))).toBeDefined();
  });

  it('returns undefined for unrelated errors', () => {
    expect(passwordErrorFromResponse(resp('EMAIL_NO_VERIFICADO'))).toBeUndefined();
    expect(passwordErrorFromResponse(new Error('boom'))).toBeUndefined();
  });

  it('exposes the rule shown under the field', () => {
    expect(PASSWORD_HINT).toBe('Mínimo 15 caracteres. Podés usar una frase; no hace falta mezclar símbolos.');
  });
});
