/**
 * The RegistrationCard's six states — DESIGN.md §5.
 *
 * These live here, outside any `"use client"` module, because `app/page.tsx` is a
 * server component and has to validate the `?debug=` parameter before rendering.
 * Next forbids calling a function exported from a client module on the server, so
 * putting the guard next to the component 500s the route at request time — and
 * because `/` is dynamic, `next build` reports success and it fails only in
 * production.
 */
export const REGISTRATION_STATES = [
  "IDLE",
  "AUTHORIZING",
  "REGISTERED",
  "SCANNING",
  "CHECKED_IN",
  "NO_SHOW",
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATES)[number];

export function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return (
    typeof value === "string" &&
    (REGISTRATION_STATES as readonly string[]).includes(value)
  );
}
