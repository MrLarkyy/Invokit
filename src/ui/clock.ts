import { toIsoDate } from '../domain/dates';

/** Today's local date, ISO. */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/** A short random id for invoice rows; ids are compared only, never shown. */
export function newRowId(): string {
  return crypto.randomUUID().slice(0, 8);
}
