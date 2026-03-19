import { NextFunction, Request, Response } from "express";

type StandardError = {
  code: string;
  message: string;
  details?: unknown;
};

const isObject = (value: unknown): value is Record<string, any> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const hasText = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isCurrentEnvelope = (value: unknown): value is Record<string, any> => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.status === "string" &&
    (hasText(value.msg) || hasText(value.message))
  );
};

const isLegacyEnvelope = (value: unknown): value is Record<string, any> => {
  if (!isObject(value)) {
    return false;
  }

  return (
    "success" in value && "data" in value && "error" in value && "meta" in value
  );
};

const isMeaningful = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (isObject(value)) {
    return Object.keys(value).length > 0;
  }

  return true;
};

const statusToCode = (status: number): string => {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 405) return "METHOD_NOT_ALLOWED";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  if (status >= 500) return "INTERNAL_ERROR";
  return "BAD_REQUEST";
};

const statusToSuccessMessage = (status: number): string => {
  if (status === 201) return "Created";
  if (status === 202) return "Accepted";
  if (status === 204) return "No content";
  return "OK";
};

const normalizeErrorPayload = (
  payload: unknown,
  statusCode: number,
): StandardError => {
  if (isObject(payload)) {
    const details = isMeaningful(payload.details) ? payload.details : undefined;

    if (hasText(payload.msg)) {
      return {
        code: String(payload.code || statusToCode(statusCode)),
        message: payload.msg,
        ...(details !== undefined ? { details } : {}),
      };
    }

    const rawError = payload.error;

    if (isObject(rawError)) {
      const nestedDetails = isMeaningful(rawError.details)
        ? rawError.details
        : details;

      return {
        code: String(rawError.code || payload.code || statusToCode(statusCode)),
        message: String(
          rawError.message || payload.message || "Request failed",
        ),
        ...(nestedDetails !== undefined ? { details: nestedDetails } : {}),
      };
    }

    if (typeof rawError === "string") {
      return {
        code: statusToCode(statusCode),
        message: rawError,
        ...(details !== undefined ? { details } : {}),
      };
    }

    if (typeof payload.message === "string") {
      return {
        code: String(payload.code || statusToCode(statusCode)),
        message: payload.message,
        ...(details !== undefined ? { details } : {}),
      };
    }
  }

  if (typeof payload === "string") {
    return {
      code: statusToCode(statusCode),
      message: payload,
    };
  }

  return {
    code: statusToCode(statusCode),
    message: "Request failed",
  };
};

const normalizeMeta = (
  payload: unknown,
): Record<string, unknown> | undefined => {
  if (!isObject(payload)) {
    return undefined;
  }

  if (isObject(payload.meta)) {
    const compactMeta = Object.entries(payload.meta).reduce<
      Record<string, unknown>
    >((acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        acc[key] = value;
      }

      return acc;
    }, {});

    return Object.keys(compactMeta).length ? compactMeta : undefined;
  }

  const page = payload.page ?? payload.paging?.page;
  const limit = payload.limit ?? payload.paging?.limit;
  const total = payload.total;
  const hasMore = payload.hasMore;
  const filter = payload.filter;

  const meta: Record<string, unknown> = {};

  if (page !== undefined) meta.page = page;
  if (limit !== undefined) meta.limit = limit;
  if (total !== undefined) meta.total = total;
  if (hasMore !== undefined) meta.hasMore = hasMore;
  if (filter !== undefined) meta.filter = filter;

  return Object.keys(meta).length ? meta : undefined;
};

const normalizeData = (payload: unknown): unknown => {
  if (payload === null || payload === undefined) {
    return undefined;
  }

  if (!isObject(payload)) {
    return payload;
  }

  if ("data" in payload) {
    return payload.data === null || payload.data === undefined
      ? undefined
      : payload.data;
  }

  const clone = { ...payload };

  delete clone.status;
  delete clone.msg;
  delete clone.message;
  delete clone.statusCode;
  delete clone.code;
  delete clone.error;
  delete clone.details;
  delete clone.meta;
  delete clone.page;
  delete clone.limit;
  delete clone.total;
  delete clone.hasMore;
  delete clone.filter;
  delete clone.paging;

  return Object.keys(clone).length ? clone : undefined;
};

const normalizeMessage = (payload: unknown, statusCode: number): string => {
  if (isObject(payload)) {
    if (hasText(payload.msg)) {
      return payload.msg;
    }

    if (hasText(payload.message)) {
      return payload.message;
    }
  }

  if (hasText(payload)) {
    return payload;
  }

  return statusToSuccessMessage(statusCode);
};

const normalizeCurrentEnvelope = (
  payload: Record<string, any>,
  statusCode: number,
) => {
  const fallbackMsg =
    payload.status === "error"
      ? "Request failed"
      : statusToSuccessMessage(statusCode);

  const response: Record<string, unknown> = {
    ...payload,
    msg: hasText(payload.msg)
      ? payload.msg
      : hasText(payload.message)
        ? payload.message
        : fallbackMsg,
  };

  delete response.message;

  if (!isMeaningful(response.data)) {
    delete response.data;
  }

  if (!isMeaningful(response.meta)) {
    delete response.meta;
  }

  if (!isMeaningful(response.details)) {
    delete response.details;
  }

  if (response.error === null || response.error === undefined) {
    delete response.error;
  }

  return response;
};

const normalizeLegacyEnvelope = (
  payload: Record<string, any>,
  statusCode: number,
) => {
  const isError = payload.success === false || statusCode >= 400;

  if (isError) {
    const normalizedError = normalizeErrorPayload(
      {
        message: payload.message,
        msg: payload.msg,
        code: payload.error?.code,
        details: payload.error?.details,
        error: payload.error,
      },
      statusCode,
    );

    return {
      status: "error",
      msg: normalizedError.message,
      code: normalizedError.code,
      ...(isMeaningful(normalizedError.details)
        ? { details: normalizedError.details }
        : {}),
    };
  }

  const response: Record<string, unknown> = {
    status: "success",
    msg: hasText(payload.msg)
      ? payload.msg
      : hasText(payload.message)
        ? payload.message
        : statusToSuccessMessage(statusCode),
  };

  if (payload.data !== null && payload.data !== undefined) {
    response.data = payload.data;
  }

  if (isMeaningful(payload.meta)) {
    response.meta = payload.meta;
  }

  return response;
};

export const responseFormatMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  const originalJson = res.json.bind(res);

  res.json = ((payload: unknown) => {
    if (isLegacyEnvelope(payload)) {
      return originalJson(normalizeLegacyEnvelope(payload, res.statusCode));
    }

    if (isCurrentEnvelope(payload)) {
      return originalJson(normalizeCurrentEnvelope(payload, res.statusCode));
    }

    if (res.statusCode >= 400) {
      const error = normalizeErrorPayload(payload, res.statusCode);
      return originalJson({
        status: "error",
        msg: error.message,
        code: error.code,
        ...(isMeaningful(error.details) ? { details: error.details } : {}),
      });
    }

    const data = normalizeData(payload);
    const meta = normalizeMeta(payload);

    return originalJson({
      status: "success",
      msg: normalizeMessage(payload, res.statusCode),
      ...(data !== undefined ? { data } : {}),
      ...(meta !== undefined ? { meta } : {}),
    });
  }) as Response["json"];

  next();
};
