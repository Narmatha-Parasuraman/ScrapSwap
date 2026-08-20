import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '..', '.env') });
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET must be set in production -- refusing to start with the insecure dev default.'
  );
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 4000,
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'scrapswap.db'),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-production',
  // Comma-separated list, e.g. "https://app.example.com,https://admin.example.com"
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim()),
};
