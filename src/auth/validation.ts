export type LoginBody = {
  email?: unknown;
  password?: unknown;
};

export type RegisterBody = LoginBody & {
  name?: unknown;
};

export type RefreshBody = {
  refreshToken?: unknown;
};

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getEmailPassword(body: LoginBody): { email: string; password: string } | null {
  if (typeof body.email !== 'string' || typeof body.password !== 'string') {
    return null;
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password;

  if (!EMAIL_PATTERN.test(email) || password.length < MIN_PASSWORD_LENGTH) {
    return null;
  }

  return { email, password };
}

export function getOptionalName(name: unknown): string | null {
  if (name === undefined || name === null) {
    return null;
  }

  if (typeof name !== 'string') {
    return null;
  }

  const normalizedName = name.trim();

  return normalizedName || null;
}

export function getRefreshToken(body: RefreshBody): string | null {
  if (typeof body.refreshToken !== 'string' || !body.refreshToken.trim()) {
    return null;
  }

  return body.refreshToken;
}
