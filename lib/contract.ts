import { getContract, type Address, type GetContractReturnType } from "viem";
import { noShowAbi } from "./abi/noShow";
import { publicClient } from "./chain";

/**
 * The ABI is generated from contracts/out/NoShow.sol/NoShow.json by
 * `npm run abi`, never hand-written. If a call here fails to typecheck after a
 * contract change, run `cd contracts && forge build && cd .. && npm run abi` —
 * do not edit lib/abi/noShow.ts.
 */
export { noShowAbi };

/**
 * Set NEXT_PUBLIC_NOSHOW_ADDRESS after deploying. It is read at module load so a
 * missing value fails loudly here rather than as a confusing "returned 0x" much
 * later in a UI callback.
 */
export const NOSHOW_ADDRESS = process.env.NEXT_PUBLIC_NOSHOW_ADDRESS as
  | Address
  | undefined;

export function requireAddress(): Address {
  if (!NOSHOW_ADDRESS) {
    throw new Error(
      "NEXT_PUBLIC_NOSHOW_ADDRESS is not set. Deploy NoShow.sol, then put the " +
        "address in .env.local and in the hosting provider's env settings.",
    );
  }
  return NOSHOW_ADDRESS;
}

/** Read-only contract handle bound to the Monad Testnet public client. */
export function noShowRead(address: Address = requireAddress()) {
  return getContract({ address, abi: noShowAbi, client: publicClient });
}

export type NoShowRead = GetContractReturnType<
  typeof noShowAbi,
  typeof publicClient
>;

/** Status codes, mirroring the STATUS_* constants in NoShow.sol. */
export const STATUS = {
  NONE: 0,
  REGISTERED: 1,
  CHECKED_IN: 2,
  NO_SHOW: 3,
} as const;
