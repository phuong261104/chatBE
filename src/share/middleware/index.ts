import { ITokenIntrospect } from "../interface";

import { MdlFactory } from "../interface/service-context";
import { authMiddleware } from "./auth";
import { allowRoles } from "./check-role";
import { createUploadMiddleware } from "./upload/upload-middleware";
import { config } from "../component/config";
export { responseFormatMiddleware } from "./response-format";

export const setupMiddlewares = (
  introspector: ITokenIntrospect,
): MdlFactory => {
  const auth = authMiddleware(introspector);

  // Initialize upload middleware with config
  const upload = createUploadMiddleware({
    maxFileSize: config.upload.maxFileSize,
    allowedMimeTypes: config.upload.allowedMimeTypes,
    destination: config.upload.destination,
    cloudBucket: config.upload.cloud.bucketName,
    cloudRegion: config.upload.cloud.region,
    cloudAccessKeyId: config.upload.cloud.accessKeyId,
    cloudSecretAccessKey: config.upload.cloud.secretAccessKey,
  });

  return {
    auth,
    allowRoles,
    upload,
  };
};
