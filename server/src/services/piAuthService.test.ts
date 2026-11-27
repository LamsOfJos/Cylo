import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensureUserAndProfile: vi.fn(),
  resolveWalletRole: vi.fn(),
  profileFindUnique: vi.fn(),
  profileUpdate: vi.fn(),
  refreshTokenCreate: vi.fn(),
}));

vi.mock('../config/index.js', () => ({
  config: { jwtSecret: 'test-jwt-secret-at-least-32-characters-long!!' },
}));
vi.mock('../config/database.js', () => ({
  prisma: {
    profile: {
      findUnique: mocks.profileFindUnique,
      update: mocks.profileUpdate,
    },
    refreshToken: { create: mocks.refreshTokenCreate },
  },
}));
vi.mock('./identityService.js', () => ({
  IdentityService: { ensureUserAndProfile: mocks.ensureUserAndProfile },
}));
vi.mock('./authService.js', () => ({
  resolveWalletRole: mocks.resolveWalletRole,
}));

import { verifyPiAccessToken } from './piAuthService.js';

describe('verifyPiAccessToken', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profileFindUnique.mockResolvedValue({ name: null });
    mocks.profileUpdate.mockResolvedValue({});
    mocks.refreshTokenCreate.mockResolvedValue({});
    mocks.resolveWalletRole.mockResolvedValue('BUYER');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects a missing access token without calling Pi', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    await expect(verifyPiAccessToken(' ')).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects access tokens Pi does not accept', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));

    await expect(verifyPiAccessToken('invalid-token')).rejects.toMatchObject({
      status: 401,
    });
    expect(mocks.ensureUserAndProfile).not.toHaveBeenCalled();
  });

  it('creates a Pi-scoped Agrocylo session from the verified Pi identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ uid: 'PiUser-123', username: 'Pioneer' }),
    );
    globalThis.fetch = fetchMock;

    const session = await verifyPiAccessToken('pi-access-token');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minepi.com/v2/me',
      expect.objectContaining({
        headers: { Authorization: 'Bearer pi-access-token' },
      }),
    );
    expect(mocks.ensureUserAndProfile).toHaveBeenCalledWith('pi:piuser-123', 'BUYER');
    expect(mocks.profileUpdate).toHaveBeenCalledWith({
      where: { walletAddress: 'pi:piuser-123' },
      data: { name: 'Pioneer' },
    });
    expect(mocks.refreshTokenCreate).toHaveBeenCalledOnce();
    expect(session.walletAddress).toBe('pi:piuser-123');
    expect(session.user).toEqual({ uid: 'PiUser-123', username: 'Pioneer' });
    expect(session.accessToken.split('.')).toHaveLength(3);
    expect(session.refreshToken).toBeTruthy();
  });

  it('maps Pi network failures to a gateway error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    await expect(verifyPiAccessToken('pi-access-token')).rejects.toMatchObject({
      status: 502,
    });
  });
});
