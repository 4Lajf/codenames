import jwt from 'jsonwebtoken';
import type { Player } from './database.types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface TokenPayload {
  id: string;
  publicId: string;
  nickname: string;
}

export function generateToken(player: Player): string {
  const payload: TokenPayload = {
    id: player.id,
    publicId: player.public_id,
    nickname: player.nickname
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
  return {
    id: decoded.id,
    publicId: decoded.publicId,
    nickname: decoded.nickname
  };
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

