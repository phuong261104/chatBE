import { z } from "zod";

const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const uuidV7 = (msg?: string) =>
  z.string().regex(UUID_V7_REGEX, msg ?? "Invalid UUID v7");

export const uuidV4 = (msg?: string) =>
  z.string().uuid(msg ?? "Invalid UUID v4");
