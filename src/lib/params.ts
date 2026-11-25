import "server-only";
import { z } from "zod";
import { HttpError } from "./http";

const uuid = z.uuid();

/** Validates a route parameter as a UUID before it ever reaches the database. */
export function uuidParam(value: string): string {
  if (!uuid.safeParse(value).success) throw new HttpError(404, "غير موجود");
  return value;
}

export type IdCtx = { params: Promise<{ id: string }> };
