import { useState } from 'react';

export type NeedsView = 'list' | 'create' | { id: number };

export interface NeedsViewState {
  view: NeedsView;
  pendingDeleteId: number | null;
  goToList(): void;
  goToCreate(): void;
  goToEdit(id: number): void;
  armDelete(id: number): void;
  clearDelete(): void;
}

/**
 * Pure view-state machine for the NeedsPage.
 * Extracted for unit testability — no network, no DOM.
 */
export function useNeedsViewState(): NeedsViewState {
  const [view, setView] = useState<NeedsView>('list');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  function goToList() {
    setView('list');
    setPendingDeleteId(null);
  }

  function goToCreate() {
    setView('create');
    setPendingDeleteId(null);
  }

  function goToEdit(id: number) {
    setView({ id });
    setPendingDeleteId(null);
  }

  function armDelete(id: number) {
    setPendingDeleteId(id);
  }

  function clearDelete() {
    setPendingDeleteId(null);
  }

  return { view, pendingDeleteId, goToList, goToCreate, goToEdit, armDelete, clearDelete };
}
