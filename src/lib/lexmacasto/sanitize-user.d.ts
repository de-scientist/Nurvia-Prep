import type { AuthUserDto } from '@/lib/api-types';
import type { LexmaCastoAuthUserRaw } from './contracts';

export function sanitizeAvatarUrl(rawUrl: unknown): string | undefined;
export function sanitizeAuthUser(rawUser: LexmaCastoAuthUserRaw | undefined | null): AuthUserDto | null;
