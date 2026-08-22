"use client";

import { x402Client } from "@x402/core/client";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import {
  UptoEvmScheme,
  createPermit2ApprovalTx,
  getPermit2AllowanceReadParams,
} from "@x402/evm/upto/client";
import type { Address, Hex, WalletClient } from "viem";
import { publicClient } from "@/lib/chain";
import { MONAD_TESTNET_USDC, MONAD_X402_NETWORK } from "@/lib/x402-constants";

/**
 * The browser half of x402, which did not exist until now.
 *
 * The important detail is that `ClientEvmSigner` only requires `address` and
 * `signTypedData`. That is exactly what MetaMask offers — `eth_signTypedData_v4`
 * is supported, `eth_signTransaction` is not — so the attendee can authorise an
 * `upto` hold from a normal injected wallet without the server ever touching a key.
 */
function toClientSigner(wallet: WalletClient, address: Address) {
  return {
    address,
    async signTypedData(message: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<Hex> {
      // The SDK hands back a well-formed EIP-712 payload, but viem's signTypedData
      // is generic over the types object and cannot infer that from a
      // Record<string, unknown>. One cast at the boundary beats restating the
      // whole Permit2 witness schema in our own types.
      const sign = wallet.signTypedData as unknown as (
        args: Record<string, unknown>,
      ) => Promise<Hex>;

      return sign({
        account: address,
        domain: message.domain,
        types: message.types,
        primaryType: message.primaryType,
        message: message.message,
      });
    },
    async readContract(args: {
      address: Address;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }) {
      return publicClient.readContract(args as never);
    },
  };
}

/**
 * Whether this wallet has approved Permit2 to move its USDC.
 *
 * The `upto` scheme is Permit2-only, so this approval is a hard precondition —
 * X402.md's `412 PRECONDITION_FAILED` is the server-side symptom of skipping it.
 * It is one transaction, once per wallet, ever. Do it before you go on stage.
 */
export async function needsPermit2Approval(owner: Address): Promise<boolean> {
  const params = getPermit2AllowanceReadParams({
    tokenAddress: MONAD_TESTNET_USDC,
    ownerAddress: owner,
  });
  const allowance = (await publicClient.readContract(params as never)) as bigint;
  // Permit2 is conventionally approved for the full uint256 range. Anything
  // meaningfully large is fine; we only care that it is not effectively zero.
  return allowance < 1_000_000_000n;
}

/** The one-time approval transaction. Send it with the connected wallet. */
export function permit2ApprovalTx() {
  return createPermit2ApprovalTx(MONAD_TESTNET_USDC);
}

const erc20BalanceAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/**
 * The payer's testnet USDC balance, in 6dp base units.
 *
 * Checked before anything is signed. The facilitator verifies the payer can
 * actually cover the authorised maximum, so a wallet holding no USDC gets rejected
 * at /verify — and the rejection reads as a vague verification failure rather than
 * "you have no USDC", which is a miserable thing to debug on a deadline.
 *
 * MON is NOT this. MON is the gas token; the hold is denominated in USDC, and the
 * two are unrelated balances. Testnet USDC comes from https://faucet.circle.com
 * with Monad Testnet selected.
 */
export async function usdcBalance(owner: Address): Promise<bigint> {
  return publicClient.readContract({
    address: MONAD_TESTNET_USDC,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: [owner],
  });
}

/**
 * Turn a 402 response body into a signed payment header.
 *
 * This is the moment the pitch describes: the wallet signs a Permit2 witness for a
 * maximum amount. No transaction is broadcast and no money moves.
 */
export async function signPaymentHeader(
  paymentRequired: PaymentRequired,
  wallet: WalletClient,
  address: Address,
): Promise<string> {
  const scheme = new UptoEvmScheme(toClientSigner(wallet, address));
  const client = new x402Client().register(MONAD_X402_NETWORK, scheme);
  const payload = await client.createPaymentPayload(paymentRequired);
  return encodePaymentSignatureHeader(payload);
}
