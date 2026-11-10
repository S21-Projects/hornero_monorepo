import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNeedsViewState } from '../needs-view-state';

describe('useNeedsViewState — view transitions', () => {
  it('starts in list view', () => {
    const { result } = renderHook(() => useNeedsViewState());
    expect(result.current.view).toBe('list');
  });

  it('transitions list → create', () => {
    const { result } = renderHook(() => useNeedsViewState());
    act(() => result.current.goToCreate());
    expect(result.current.view).toBe('create');
  });

  it('transitions list → edit(id)', () => {
    const { result } = renderHook(() => useNeedsViewState());
    act(() => result.current.goToEdit(42));
    expect(result.current.view).toEqual({ id: 42 });
  });

  it('transitions create → list', () => {
    const { result } = renderHook(() => useNeedsViewState());
    act(() => result.current.goToCreate());
    act(() => result.current.goToList());
    expect(result.current.view).toBe('list');
  });

  it('transitions edit → list', () => {
    const { result } = renderHook(() => useNeedsViewState());
    act(() => result.current.goToEdit(7));
    act(() => result.current.goToList());
    expect(result.current.view).toBe('list');
  });
});

describe('useNeedsViewState — pendingDeleteId', () => {
  it('starts with pendingDeleteId null', () => {
    const { result } = renderHook(() => useNeedsViewState());
    expect(result.current.pendingDeleteId).toBeNull();
  });

  it('armDelete sets pendingDeleteId', () => {
    const { result } = renderHook(() => useNeedsViewState());
    act(() => result.current.armDelete(99));
    expect(result.current.pendingDeleteId).toBe(99);
  });

  it('clearDelete resets pendingDeleteId to null', () => {
    const { result } = renderHook(() => useNeedsViewState());
    act(() => result.current.armDelete(99));
    act(() => result.current.clearDelete());
    expect(result.current.pendingDeleteId).toBeNull();
  });

  it('goToList also clears pendingDeleteId', () => {
    const { result } = renderHook(() => useNeedsViewState());
    act(() => result.current.armDelete(5));
    act(() => result.current.goToList());
    expect(result.current.pendingDeleteId).toBeNull();
  });

  it('goToCreate also clears pendingDeleteId', () => {
    const { result } = renderHook(() => useNeedsViewState());
    act(() => result.current.armDelete(5));
    act(() => result.current.goToCreate());
    expect(result.current.pendingDeleteId).toBeNull();
  });

  it('goToEdit also clears pendingDeleteId', () => {
    const { result } = renderHook(() => useNeedsViewState());
    act(() => result.current.armDelete(5));
    act(() => result.current.goToEdit(3));
    expect(result.current.pendingDeleteId).toBeNull();
  });
});
