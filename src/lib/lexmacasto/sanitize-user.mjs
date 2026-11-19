/**
 * Pure Native ESM User Sanitizer for LexmaCasto/Strata Auth Responses.
 * Preserves `guidId`, `userName`, object-shaped `roles: [{ name, rank }]`,
 * `emailConfirmed`, and `emails[].isVerified` while stripping raw credentials.
 */

export function sanitizeAvatarUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Reject unsafe or malformed schemes
  }
  return undefined;
}

function resolvePrimaryRole(rawUser) {
  if (typeof rawUser.role === 'string' && rawUser.role.trim()) {
    return rawUser.role.trim();
  }
  if (Array.isArray(rawUser.roles) && rawUser.roles.length > 0) {
    const normalized = rawUser.roles
      .map((entry) => {
        if (typeof entry === 'string') {
          return { name: entry.trim(), rank: Number.MAX_SAFE_INTEGER };
        }
        if (entry && typeof entry === 'object') {
          const roleName = String(entry.name ?? entry.roleName ?? '').trim();
          const rank =
            typeof entry.rank === 'number' && Number.isFinite(entry.rank)
              ? entry.rank
              : Number.MAX_SAFE_INTEGER;
          return { name: roleName, rank };
        }
        return { name: '', rank: Number.MAX_SAFE_INTEGER };
      })
      .filter((r) => Boolean(r.name))
      .sort((a, b) => a.rank - b.rank);

    if (normalized.length > 0) {
      return normalized[0].name;
    }
  }
  return 'Learner';
}

export function sanitizeAuthUser(rawUser) {
  if (!rawUser || typeof rawUser !== 'object') return null;

  const guidIdRaw = rawUser.guidId ?? rawUser.userGuidId;
  const guidId =
    typeof guidIdRaw === 'string' && guidIdRaw.trim() ? guidIdRaw.trim() : undefined;
  const id = String(rawUser.id ?? rawUser.userId ?? guidId ?? rawUser.email ?? '').trim();
  const email = typeof rawUser.email === 'string' ? rawUser.email.trim() : '';

  const name =
    (typeof rawUser.name === 'string' && rawUser.name.trim()) ||
    (typeof rawUser.fullName === 'string' && rawUser.fullName.trim()) ||
    (typeof rawUser.userName === 'string' && rawUser.userName.trim()) ||
    (typeof rawUser.username === 'string' && rawUser.username.trim()) ||
    email;

  const role = resolvePrimaryRole(rawUser);

  if (!email && !id) return null;

  const profilePicture =
    rawUser.profile && typeof rawUser.profile === 'object'
      ? rawUser.profile.profilePicture
      : undefined;

  let emailVerified = false;
  if (typeof rawUser.emailVerified === 'boolean') {
    emailVerified = rawUser.emailVerified;
  } else if (typeof rawUser.emailConfirmed === 'boolean') {
    emailVerified = rawUser.emailConfirmed;
  } else if (typeof rawUser.isEmailVerified === 'boolean') {
    emailVerified = rawUser.isEmailVerified;
  } else if (typeof rawUser.email_verified === 'boolean') {
    emailVerified = rawUser.email_verified;
  } else if (Array.isArray(rawUser.emails) && rawUser.emails.length > 0) {
    const primaryMatch = rawUser.emails.find(
      (e) =>
        e &&
        typeof e === 'object' &&
        (e.isPrimary === true ||
          (email && typeof e.email === 'string' && e.email.toLowerCase() === email.toLowerCase()))
    );
    emailVerified = Boolean(
      primaryMatch ? primaryMatch.isVerified : rawUser.emails.some((e) => e && e.isVerified === true)
    );
  } else {
    emailVerified = Boolean(rawUser.email_verified_at || rawUser.emailVerifiedAt);
  }

  return {
    id: id || email,
    ...(guidId ? { guidId } : {}),
    name,
    email,
    role,
    dashboardName: typeof rawUser.dashboardName === 'string' ? rawUser.dashboardName : undefined,
    avatarUrl: sanitizeAvatarUrl(rawUser.avatarUrl ?? profilePicture ?? rawUser.profilePicture),
    emailVerified,
  };
}
