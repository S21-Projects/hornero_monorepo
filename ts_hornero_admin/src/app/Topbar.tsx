import type { AuthUser, UserRole } from '../store/auth.store';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/Badge';
import { Text } from '../components/ui/Typography';
import { ROLE_LABELS } from '../lib/metricas';
import type { BadgeTone } from '../lib/domain-ui';

const ROLE_TONE: Record<UserRole, BadgeTone> = {
  ADMINISTRADOR: 'sky',
  REFERENTE: 'ok',
  DONANTE: 'neutral',
};

interface TopbarProps {
  user: AuthUser | null;
}

export function Topbar({ user }: TopbarProps) {
  return (
    <header
      style={{
        height: 64,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        padding: '0 24px',
        background: 'var(--card)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      {user && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <Text variant="body-sm" style={{ fontWeight: 800, lineHeight: 1.1 }}>{user.nombre}</Text>
            <Badge tone={ROLE_TONE[user.tipo]} label={ROLE_LABELS[user.tipo]} />
          </div>
          <Avatar name={user.nombre} size={38} />
        </>
      )}
    </header>
  );
}
