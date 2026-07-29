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
    baseUrl: config.upload.baseUrl,
    cloudEnabled: config.upload.cloud.enabled,
    cloudProvider: config.upload.cloud.provider,
    cloudBucket: config.upload.cloud.bucketName,
    cloudRegion: config.upload.cloud.region,
    cloudEndpoint: config.upload.cloud.endpoint,
    cloudPublicEndpoint: config.upload.cloud.publicEndpoint,
    cloudPublicBaseUrl: config.upload.cloud.publicBaseUrl,
    cloudForcePathStyle: config.upload.cloud.forcePathStyle,
    cloudAccessKeyId: config.upload.cloud.accessKeyId,
    cloudSecretAccessKey: config.upload.cloud.secretAccessKey,
  });

  return {
    auth,
    allowRoles,
    upload,
  };
};
