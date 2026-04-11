import { AppError } from "@share/app-error";

export const ErrDataNotFound = AppError.from(new Error("Data not found"), 404);
