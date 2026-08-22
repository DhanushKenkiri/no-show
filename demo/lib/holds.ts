import type { PaymentPayload, PaymentRequirements, SettleResponse } from "@x402/core/types";
import { getAddress, keccak256, stringToHex, type Address, type Hex } from "viem";

export type HoldState = "AUTHORIZED" | "RELEASING" | "RELEASED" | "UNKNOWN";

export type RegistrationHold = {
  eventId: Hex;
  payer: Address;
  authRef: Hex;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
  createdAt: string;
  state: HoldState;
  settlement?: SettleResponse;
  settlementPromise?: Promise<SettleResponse>;
};

// This is intentionally process-local. SPEC.md explicitly calls for a module-level
// Map rather than a database; a deployment should consequently use a single
// long-lived instance for the live demo.
const holds = new Map<string, RegistrationHold>();

export function holdKey(eventId: Hex, payer: Address): string {
  return `${eventId.toLowerCase()}:${payer.toLowerCase()}`;
}

export function getHold(eventId: Hex, payer: Address): RegistrationHold | undefined {
  return holds.get(holdKey(eventId, payer));
}

export function putHold(hold: RegistrationHold): void {
  holds.set(holdKey(hold.eventId, hold.payer), hold);
}

/** The on-chain register event needs a compact audit reference, not the payload. */
export function authorizationReference(paymentPayload: PaymentPayload): Hex {
  return keccak256(stringToHex(JSON.stringify(paymentPayload)));
}

export function normalizedPayer(payer: string): Address {
  return getAddress(payer);
}
