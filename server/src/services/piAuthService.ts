import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { ApiError } from '../http/errors.js';
import { IdentityService } from './identityService.js';
import { resolveWalletRole } from './authService.js';

const PI_API_ME_URL = 'https://api.minepi.com/v2/me';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PiUser {
  uid: string;
  username: string;
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Verify the Pi access token with Pi, then issue Agrocylo's own session. */
export async function verifyPiAccessToken(
  accessToken: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  walletAddress: string;
  user: { uid: string; username: string };
}> {
  const token = accessToken.trim();
  if (!token || token.length > 4096) {
    throw new ApiError(400, 'Bad Request', 'A valid Pi access token is required');
  }

  let response: Response;
  try {
    response = await fetch(PI_API_ME_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(502, 'Bad Gateway', 'Could not verify identity with Pi');
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError(401, 'Unauthorized', 'Pi access token is invalid or expired');
  }
  if (!response.ok) {
    throw new ApiError(502, 'Bad Gateway', 'Pi identity verification failed');
  }

  let piUser: PiUser;
  try {
    const body = (await response.json()) as Partial<PiUser>;
    if (
      typeof body.uid !== 'string' ||
      !body.uid.trim() ||
      typeof body.username !== 'string' ||
      !body.username.trim()
    ) {
      throw new Error('Malformed Pi user response');
    }
    piUser = { uid: body.uid.trim(), username: body.username.trim() };
  } catch {
    throw new ApiError(502, 'Bad Gateway', 'Pi returned an invalid identity response');
  }

  // Prefix Pi identities so they cannot collide with Stellar public keys in
  // the existing identity tables. The Pi UID, not the client-supplied profile,
  // is the authority for this principal.
  const walletAddress = `pi:${piUser.uid.toLowerCase()}`;
  await IdentityService.ensureUserAndProfile(walletAddress, 'BUYER');
  const profile = await prisma.profile.findUnique({
    where: { walletAddress },
    select: { name: true },
  });
  if (!profile?.name) {
    await prisma.profile.update({
      where: { walletAddress },
      data: { name: piUser.username },
    });
  }

  const role = await resolveWalletRole(walletAddress);
  const appAccessToken = jwt.sign({ walletAddress, role }, config.jwtSecret, {
    expiresIn: JWT_EXPIRES_IN,
  });
  const refreshToken = crypto.randomBytes(40).toString('hex');
  await prisma.refreshToken.create({
    data: {
      walletAddress,
      token: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return {
    accessToken: appAccessToken,
    refreshToken,
    walletAddress,
    user: { uid: piUser.uid, username: piUser.username },
  };
}
