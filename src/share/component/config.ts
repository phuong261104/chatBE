import dotenv from "dotenv";

dotenv.config();

export const config = {
  rpc: {
    productBrand: process.env.RPC_PRODUCT_BRAND_URL || "http://localhost:3000",
    productCategory:
      process.env.RPC_PRODUCT_CATEGORY_URL || "http://localhost:3000",
  },
  mongoose: {
    uri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017",
    dbName: process.env.MONGODB_DB_NAME || "express_ts_app",
  },
  mysql: {
    database: process.env.DB_NAME || "",
    username: process.env.DB_USERNAME || "",
    password: process.env.DB_PASSWORD || "",
    host: process.env.DB_HOST || "",
    port: parseInt(process.env.DB_PORT as string),
    dialect: "mysql",
    pool: {
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 60000,
    },
    logging: true,
  },
  accessToken: {
    secretKey: process.env.JWT_SECRET_KEY || "chat_app_secret",
    expiresIn: "7d",
  },
};
