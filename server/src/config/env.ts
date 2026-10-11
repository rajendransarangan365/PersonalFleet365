import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file in development
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),

  MONGODB_URI: z.string().min(10).default('mongodb+srv://sarangan365_db_user:Secure2711@fleet365.jkjxj7t.mongodb.net/fleetwise?retryWrites=true&w=majority&appName=Fleet365'),

  JWT_ACCESS_SECRET: z.string().min(8).default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  JWT_REFRESH_SECRET: z.string().min(8).default('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  COOKIE_SECRET: z.string().min(8).default('fleetwise_cookie_secret_key_12345'),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  SMTP_SERVICE: z.string().default('gmail'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_MAIL: z.string().default('rightsight365@gmail.com'),
  SMTP_PASSWORD: z.string().default(''),
  TO_ME_EMAIL: z.string().default('sarangan365@gmail.com'),
  TO_ME_MOBILE: z.string().default('1234567890'),
  EMAIL_FROM: z.string().default('FleetWise <rightsight365@gmail.com>'),

  CLOUDINARY_CLOUD_NAME: z.string().default('dh9vdxaqv'),
  CLOUDINARY_API_KEY: z.string().default('564923498847162'),
  CLOUDINARY_API_SECRET: z.string().default('FV3KegyCL_IVUW4wxlHAzKBxmxI'),
  GOOGLE_CLIENT_ID: z.string().default(''),

  UPLOAD_MAX_SIZE_MB: z.coerce.number().int().min(1).max(50).default(10),
  UPLOAD_DIR: z.string().default('./uploads'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().default(100),

  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:5000'),

  GEMINI_API_KEY: z.string().default(''),
});

let parsedEnv: z.infer<typeof EnvSchema>;

try {
  parsedEnv = EnvSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    console.error(error.flatten().fieldErrors);
  } else {
    console.error('❌ Error parsing environment variables:', error);
  }
  process.exit(1);
}

export const env: z.infer<typeof EnvSchema> = parsedEnv;
export type Env = z.infer<typeof EnvSchema>;
