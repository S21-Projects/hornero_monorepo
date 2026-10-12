import { useEffect } from 'react';
import { useNoticeStore } from '../../store/notice.store';
import type { Notice } from '../../store/notice.store';

const VISIBLE_MS = 6000;

function NoticeItem({ notice }: { notice: Notice }) {
  const dismiss = useNoticeStore((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => { dismiss(notice.id); }, VISIBLE_MS);
    return () => { clearTimeout(timer); };
  }, [notice.id, dismiss]);

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        padding: '12px 14px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        maxWidth: 380,
        fontSize: 'var(--fs-body-sm)',
        color: 'var(--ink-2)',
      }}
    >
      <span style={{ flex: 1 }}>{notice.message}</span>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => { dismiss(notice.id); }}
        style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}

/** Mount once near the app root. A polite live region: it never steals focus or blocks input. */
export function NoticeHost() {
  const notices = useNoticeStore((s) => s.notices);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {notices.map((n) => (
        <NoticeItem key={n.id} notice={n} />
      ))}
    </div>
  );
}
