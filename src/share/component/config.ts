import dotenv from "dotenv";

dotenv.config();

export const config = {
  envName: process.env.NODE_ENV,
  rpc: {
    productBrand: process.env.RPC_PRODUCT_BRAND_URL || "http://localhost:3000",
    productCategory:
      process.env.RPC_PRODUCT_CATEGORY_URL || "http://localhost:3000",
  },
  mongoose: {
    uri: process.env.MONGO_URI || "mongodb://localhost:27017/express_ts_app",
    dbName: process.env.MONGODB_DB_NAME || "express_ts_app",
  },
  redis: {
    host: process.env.REDIS_HOST || "redis://localhost:6379",
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    url: process.env.REDIS_URL,
  },
  accessToken: {
    secretKey: process.env.JWT_SECRET_KEY || "200L@b.io",
    expiresIn: "7d",
  },
  upload: {
    maxFileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || "10485760"), // 10MB default
    destination: process.env.UPLOAD_DESTINATION || "./uploads",
    baseUrl: process.env.UPLOAD_BASE_URL || "http://localhost:3000/uploads",
    allowedMimeTypes: (
      process.env.UPLOAD_ALLOWED_MIME_TYPES ||
      "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/mpeg,video/quicktime,audio/mpeg,audio/wav,application/pdf"
    ).split(","),
    // Cloud storage settings (optional - for future use)
    cloud: {
      enabled: process.env.CLOUD_STORAGE_ENABLED === "true",
      provider: process.env.CLOUD_STORAGE_PROVIDER || "aws", // 'aws', 'azure', 'gcp'
      bucketName: process.env.CLOUD_BUCKET_NAME || "",
      region: process.env.CLOUD_REGION || "",
      accessKeyId: process.env.CLOUD_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.CLOUD_SECRET_ACCESS_KEY || "",
    },
  },
};
