import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeAuthUser, sanitizeAvatarUrl } from '../src/lib/lexmacasto/sanitize-user.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRel = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Global Navbar, Tailwind v4 Tokens, Avatar Fallback & Auth Sanitization', () => {
  it('sanitizes backend users preserving guidId, userName, object roles, and email verification', () => {
    const sanitized = sanitizeAuthUser({
      id: 42,
      guidId: 'user-guid-999',
      userName: 'NurseJane',
      email: 'jane@nurvia.org',
      emailConfirmed: true,
      roles: [
        { name: 'Learner', rank: 2 },
        { name: 'Superadmin', rank: 1 },
      ],
      profile: {
        profilePicture: 'https://cdn.explicitbackend.com/avatars/jane.png',
      },
    });

    assert.equal(sanitized.guidId, 'user-guid-999');
    assert.equal(sanitized.name, 'NurseJane');
    assert.equal(sanitized.role, 'Superadmin');
    assert.equal(sanitized.emailVerified, true);
    assert.equal(sanitized.avatarUrl, 'https://cdn.explicitbackend.com/avatars/jane.png');

    // emails[] array verification fallback + unsafe URL stripping
    const fromEmails = sanitizeAuthUser({
      id: 'u-2',
      email: 'verified@nurvia.org',
      emails: [{ email: 'verified@nurvia.org', isVerified: true, isPrimary: true }],
      avatarUrl: 'javascript:alert(1)',
    });
    assert.equal(fromEmails.emailVerified, true);
    assert.equal(fromEmails.avatarUrl, undefined);
    assert.equal(sanitizeAvatarUrl('/uploads/ok.png'), '/uploads/ok.png');
  });

  it('defines complete Tailwind v4 semantic card/muted/destructive tokens in globals.css', () => {
    const css = readRel('src/app/globals.css');
    for (const token of [
      '--color-card:',
      '--color-card-foreground:',
      '--color-muted:',
      '--color-muted-foreground:',
      '--color-destructive:',
      '--color-surface-card:',
      '--color-surface-primary:',
      '--color-brand-tealDeep:',
    ]) {
      assert.ok(css.includes(token), `globals.css @theme inline missing ${token}`);
    }
  });

  it('fixes navbar overflow clipping, broken avatar fallback, avatar refresh sync, and Qlex auth security', () => {
    const learnerShell = readRel('src/components/layout/learner-shell.tsx');
    assert.ok(learnerShell.includes('overflow-x-clip'), 'LearnerShell header must use overflow-x-clip so dropdown is never clipped');
    assert.ok(!learnerShell.includes('<header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-border bg-surface/90 backdrop-blur-md px-4 sm:px-6 overflow-x-hidden">'));

    const avatarSrc = readRel('src/components/shared/avatar/UserAvatar.tsx');
    assert.ok(avatarSrc.startsWith('"use client";'), 'UserAvatar must declare use client');
    assert.ok(avatarSrc.includes('naturalWidth === 0'), 'UserAvatar must handle cached broken images');

    const authProvider = readRel('src/components/auth/auth-provider.tsx');
    assert.ok(authProvider.includes('nurvia:avatar-updated'), 'AuthProvider must listen for live avatar updates');

    const logoutPage = readRel('src/app/(web)/auth/logout/page.tsx');
    assert.ok(logoutPage.includes('signOut()'), 'Web logout page must tear down authenticated sessions');

    const oneTapRoute = readRel('src/app/api/auth/social/onetap/route.ts');
    assert.ok(oneTapRoute.includes('validateSameOriginRequest'), 'One Tap route must enforce CSRF');
    assert.ok(!oneTapRoute.includes('casto_badge'), 'One Tap route must not leak raw casto_badge in JSON response');
    assert.ok(oneTapRoute.includes('setServerCastoSession'), 'One Tap route must store credentials in HttpOnly cookies');

    const supportProxy = readRel('src/lib/lexmacasto/support-proxy.ts');
    assert.ok(supportProxy.includes('validateSameOriginRequest'));
    assert.ok(supportProxy.includes('131_072'));
  });
});
