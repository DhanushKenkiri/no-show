"use client";

import { x402Client } from "@x402/core/client";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { UptoEvmScheme } from "@x402/evm/upto/client";
import type { Address, Hex, WalletClient } from "viem";

/**
 * Turn a 402 body into a signed payment header.
 *
 * The load-bearing detail: `ClientEvmSigner` needs only `address` and
 * `signTypedData`. That is exactly what MetaMask offers — eth_signTypedData_v4 is
 * supported, eth_signTransaction is NOT — so an ordinary injected wallet can
 * authorise an `upto` hold without any server ever holding a key.
 *
 * This is the moment the whole product describes: the wallet signs a Permit2
 * witness for a maximum amount. No transaction is broadcast and no money moves.
 */
export async function signPaymentHeader(
  paymentRequired: PaymentRequired,
  wallet: WalletClient,
  address: Address,
  network = "eip155:10143",
): Promise<string> {
  const signer = {
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
      // entire Permit2 witness schema in our own types.
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
  };

  const scheme = new UptoEvmScheme(signer);
  const client = new x402Client().register(network as `${string}:${string}`, scheme);
  return encodePaymentSignatureHeader(await client.createPaymentPayload(paymentRequired));
}
