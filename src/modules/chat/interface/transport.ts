export interface ControllerErrorJson {
  message?: string;
  details?: unknown;
}

export interface ControllerErrorLike {
  message?: string;
  statusCode?: number;
  getStatusCode?: () => number;
  toJSON?: (isProduction: boolean) => ControllerErrorJson;
}
