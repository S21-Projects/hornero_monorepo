import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api } from './axios';
import { useNoticeStore, REPLAY_NOTICE } from '../store/notice.store';

const mock = new MockAdapter(api, { onNoMatch: 'throwException' });

beforeEach(() => {
  mock.reset();
  useNoticeStore.setState({ notices: [] });
});

describe('Idempotent-Replayed (M7)', () => {
  it('raises one notice when a response carries Idempotent-Replayed: true', async () => {
    mock.onPost('/donaciones').reply(201, { id: 1 }, { 'idempotent-replayed': 'true' });

    const res = await api.post('/donaciones', {});

    expect(res.data).toEqual({ id: 1 });
    const { notices } = useNoticeStore.getState();
    expect(notices).toHaveLength(1);
    expect(notices[0]!.message).toBe(REPLAY_NOTICE);
    expect(REPLAY_NOTICE).toBe('Esta operación ya se había registrado; no se volvió a ejecutar.');
  });

  it('stays silent for a normal response', async () => {
    mock.onPost('/donaciones').reply(201, { id: 1 });

    await api.post('/donaciones', {});

    expect(useNoticeStore.getState().notices).toHaveLength(0);
  });

  it('does not duplicate the notice while an identical one is showing', async () => {
    mock.onPost('/donaciones').reply(201, {}, { 'idempotent-replayed': 'true' });

    await api.post('/donaciones', {});
    await api.post('/donaciones', {});

    expect(useNoticeStore.getState().notices).toHaveLength(1);
  });
});
