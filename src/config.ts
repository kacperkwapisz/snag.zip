const env = Bun.env;

export const config = {
  port: Number(env.PORT ?? 3000),
  baseUrl: env.BASE_URL ?? "http://localhost:3000",

  s3: {
    endpoint: env.S3_ENDPOINT ?? "",
    bucket: env.S3_BUCKET ?? "snag-zip",
    accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
  },

  admin: {
    username: env.ADMIN_USERNAME ?? "admin",
    password: env.ADMIN_PASSWORD ?? "changeme",
  },

  publicUploads: env.PUBLIC_UPLOADS === "true",
  allowNeverExpiry: env.ALLOW_NEVER_EXPIRY !== "false",
  maxFileSize: Number(env.MAX_FILE_SIZE ?? 104_857_600), // 100MB
  defaultExpiryHours: Number(env.DEFAULT_EXPIRY_HOURS ?? 168), // 7 days
  databasePath: env.DATABASE_PATH ?? "snag.db",
} as const;
