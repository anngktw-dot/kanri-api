import 'dotenv/config';

const DEFAULT_PORT = 3000;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_CORS_ORIGIN = '*';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPort(): number {
  const value = process.env.PORT;

  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function getOptionalPositiveInteger(name: string, defaultValue: number): number {
  const value = process.env[name];

  if (!value) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsedValue;
}

export const config = {
  databaseUrl: getRequiredEnv('DATABASE_URL'),
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  port: getPort(),
  accessTokenTtlSeconds: getOptionalPositiveInteger(
    'ACCESS_TOKEN_TTL_SECONDS',
    DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  ),
  refreshTokenTtlSeconds: getOptionalPositiveInteger(
    'REFRESH_TOKEN_TTL_SECONDS',
    DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
  ),
  corsOrigin: process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN,
};
