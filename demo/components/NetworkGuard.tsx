"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { chain } from "@/lib/chain";

/**
 * Keeps the connected wallet on Monad Testnet.
 *
 * Without this, connecting from the MetaMask mobile app shows "Wrong network" and
 * stops there. The reason is not a bug in the app: a fresh MetaMask has never
 * heard of Monad Testnet, so after connecting it stays on whatever chain it was
 * already on — usually Ethereum mainnet — and every wagmi hook reports an
 * unsupported chain.
 *
 * So rather than reporting the problem, fix it. On connect, if the wallet is on
 * the wrong chain, request a switch. wagmi's switchChain sends
 * `wallet_switchEthereumChain` first and, when the wallet answers 4902 (unknown
 * chain), falls back to `wallet_addEthereumChain` using the chain definition —
 * which is why lib/chain.ts carries a full nativeCurrency, rpcUrls and
 * blockExplorers. A wallet cannot add a chain it has not been described.
 *
 * The automatic attempt fires once per connection. Repeating it would spam a
 * confirmation dialog at someone who just declined, so a decline falls through to
 * a button they can press when they mean it.
 */
/** True when a wallet is connected but sitting on the wrong chain. */
export function useWrongNetwork(): boolean {
  const { isConnected, chainId } = useAccount();
  return isConnected && chainId !== chain.id;
}

export function NetworkGuard() {
  // `useAccount().chainId` is the chain the WALLET is actually on. `useChainId()`
  // reports the config's current chain, which for an unsupported network falls
  // back to a configured one — so it would report the right chain while the
  // wallet sat on the wrong one, and the guard would never fire.
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  const [declined, setDeclined] = useState(false);
  const attemptedFor = useRef<number | null>(null);

  const wrongNetwork = isConnected && chainId !== chain.id;

  const requestSwitch = useCallback(() => {
    setDeclined(false);
    switchChain(
      { chainId: chain.id },
      {
        onError: () => setDeclined(true),
      },
    );
  }, [switchChain]);

  useEffect(() => {
    if (!wrongNetwork) {
      attemptedFor.current = null;
      setDeclined(false);
      return;
    }
    // Once per wrong chain, not once per render.
    if (chainId === undefined || attemptedFor.current === chainId) return;
    attemptedFor.current = chainId;
    requestSwitch();
  }, [wrongNetwork, chainId, requestSwitch]);

  if (!wrongNetwork) return null;

  return (
    <div className="networkGuard" role="status">
      <span>
        {isPending
          ? `Switching to ${chain.name}…`
          : declined
            ? `This event lives on ${chain.name}. Approve the switch in your wallet to continue.`
            : `Your wallet is on the wrong network. Switching to ${chain.name}…`}
      </span>
      {!isPending && (
        <button type="button" className="btn btnAccent" onClick={requestSwitch}>
          Switch to {chain.name}
        </button>
      )}
    </div>
  );
}
