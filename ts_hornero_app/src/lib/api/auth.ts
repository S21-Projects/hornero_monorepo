import { api } from '@/lib/axios';

export interface RegisterPayload {
  nombre: string;
  email: string;
  password: string;
  tipo: 'REFERENTE' | 'DONANTE';
}

export async function registerUser(payload: RegisterPayload): Promise<void> {
  await api.post('/auth/register', payload);
}
