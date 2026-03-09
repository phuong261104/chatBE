import { ITokenIntrospect } from '../interface';

import { MdlFactory } from '../interface/service-context';
import { authMiddleware } from './auth';
import { allowRoles } from './check-role';
import { createUploadMiddleware } from './upload/upload-middleware';
import { config } from '../component/config';

export const setupMiddlewares = (introspector: ITokenIntrospect): MdlFactory => {
  const auth = authMiddleware(introspector);

  // Initialize upload middleware with config
  const upload = createUploadMiddleware({
    maxFileSize: config.upload.maxFileSize,
    allowedMimeTypes: config.upload.allowedMimeTypes,
    destination: config.upload.destination
  });

  return {
    auth,
    allowRoles,
    upload
  };
};
