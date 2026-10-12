import { create } from 'zustand';

/** N11/M7: shown when the MS answers a retried business POST from its idempotency record. */
export const REPLAY_NOTICE = 'Esta operación ya se había registrado; no se volvió a ejecutar.';

export interface Notice {
  id: number;
  message: string;
}

interface NoticeState {
  notices: Notice[];
  push: (message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** Non-blocking, app-wide notices (rendered by `NoticeHost`). Identical messages are not stacked. */
export const useNoticeStore = create<NoticeState>((set) => ({
  notices: [],
  push: (message) =>
    set((s) =>
      s.notices.some((n) => n.message === message)
        ? s
        : { notices: [...s.notices, { id: nextId++, message }] },
    ),
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));
