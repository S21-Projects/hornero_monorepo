export type UserRole = 'ADMINISTRADOR' | 'REFERENTE' | 'DONANTE';

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMINISTRADOR: 'Administrador',
  REFERENTE: 'Referente',
  DONANTE: 'Donante',
};
