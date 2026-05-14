import dotenv from "dotenv";

dotenv.config();

export const config = {
  envName: process.env.NODE_ENV,
  rpc: {
    productBrand: process.env.RPC_PRODUCT_BRAND_URL || "http://localhost:3000",
    productCategory:
      process.env.RPC_PRODUCT_CATEGORY_URL || "http://localhost:3000",
  },
  dynamodb: {
    region: process.env.DYNAMODB_REGION || "localhost",
    endpoint: process.env.DYNAMODB_ENDPOINT || "",
    tablePrefix: process.env.DYNAMODB_TABLE_PREFIX !== undefined ? process.env.DYNAMODB_TABLE_PREFIX : "",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  redis: {
    host: process.env.REDIS_HOST || "redis://localhost:6379",
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    url: process.env.REDIS_URL,
  },
  accessToken: {
    secretKey: process.env.JWT_ACCESS_SECRET || "access-secret-key-change-in-production-min-32chars",
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  },
  refreshToken: {
    secretKey: process.env.JWT_REFRESH_SECRET || "refresh-secret-key-change-in-production-min-32chars",
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  passwordReset: {
    secretKey: process.env.JWT_PASSWORD_RESET_SECRET || "reset-secret-key-change-in-production",
    expiresIn: process.env.JWT_PASSWORD_RESET_EXPIRES_IN || "1h",
  },
  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "hideonbush2611@gmail.com",
      pass: process.env.SMTP_PASS || "qaiy paqo ijce xaox",
    },
    from: process.env.EMAIL_FROM || "noreply@chatbe.io",
    fromName: process.env.EMAIL_FROM_NAME || "ChatBE",
  },
  app: {
    url: process.env.APP_URL || "http://localhost:3000",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  },
  auth: {
    requireEmailVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
  },
  upload: {
    maxFileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || "10485760"),
    destination: process.env.UPLOAD_DESTINATION || "./uploads",
    baseUrl: process.env.UPLOAD_BASE_URL || "http://localhost:3000/uploads",
    allowedMimeTypes: (
      process.env.UPLOAD_ALLOWED_MIME_TYPES ||
      "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/mpeg,video/quicktime,audio/mpeg,audio/wav,application/pdf"
    ).split(","),
    cloud: {
      enabled: process.env.CLOUD_STORAGE_ENABLED === "true",
      provider: process.env.CLOUD_STORAGE_PROVIDER || "aws",
      bucketName: process.env.CLOUD_BUCKET_NAME || "",
      region: process.env.CLOUD_REGION || "",
      accessKeyId: process.env.CLOUD_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.CLOUD_SECRET_ACCESS_KEY || "",
    },
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || "1024"),
    temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
  },
  livekit: {
    apiKey: process.env.LIVEKIT_API_KEY || "",
    apiSecret: process.env.LIVEKIT_API_SECRET || "",
    wsUrl: process.env.LIVEKIT_WS_URL || "ws://localhost:7880",
    cloud: {
      apiKey: process.env.LIVEKIT_CLOUD_API_KEY || "",
      apiSecret: process.env.LIVEKIT_CLOUD_API_SECRET || "",
      wsUrl: process.env.LIVEKIT_CLOUD_WS_URL || "",
    },
  },
};
