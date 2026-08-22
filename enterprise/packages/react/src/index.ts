/**
 * @noshow/react — drop-in components for a platform that already has a frontend.
 *
 * Import the stylesheet once:
 *   import "@noshow/react/styles.css";
 *
 * Then either use `useHold` headlessly with your own markup, or render the
 * components below. Both paths drive the same six-state model.
 */
export { RegistrationCard, Scanner, VenueDisplay, CommitPill } from "./components.js";
export type { RegistrationCardProps } from "./components.js";

export { useHold, readableError } from "./useHold.js";
export type { HoldStatus, HoldProgress, UseHoldOptions } from "./useHold.js";

export { signPaymentHeader } from "./sign.js";
