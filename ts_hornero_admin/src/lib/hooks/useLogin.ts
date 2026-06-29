import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';

interface LoginVariables {
  email: string;
  password: string;
}

/**
 * React Query mutation bridge to auth store login.
 * Establishes the RQ → store pattern for all future auth hooks.
 */
export function useLogin() {
  const login = useAuthStore((s) => s.login);

  return useMutation<void, Error, LoginVariables>({
    mutationFn: ({ email, password }) => login(email, password),
  });
}
