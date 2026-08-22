"use client";

import { VenueDisplay } from "@noshow/react";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { usePublicClient } from "wagmi";

export function DisplayClient({ eventId }: { eventId: Hex }) {
  const publicClient = usePublicClient();
  const [block, setBlock] = useState<bigint | null>(null);

  useEffect(() => {
    if (!publicClient) return;
    // Polling at 250ms gives good resolution against ~400ms blocks while staying
    // far under the public RPC's rate limit. No contract read per block: the
    // challenge is derived locally from exactly the expression the contract uses.
    const unwatch = publicClient.watchBlockNumber({
      emitOnBegin: true,
      poll: true,
      pollingInterval: 250,
      onBlockNumber: setBlock,
    });
    return () => unwatch();
  }, [publicClient]);

  return <VenueDisplay eventId={eventId} blockNumber={block} />;
}
