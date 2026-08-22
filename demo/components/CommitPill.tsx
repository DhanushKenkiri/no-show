"use client";

import { useEffect, useRef, useState } from "react";
import { publicClient } from "@/lib/chain";
import { COMMIT_STATES } from "@/lib/chain";

/**
 * The one place the chain is allowed to be loud — DESIGN.md §4.13.
 *
 * Monad's block tags map to commit states: `latest` is Proposed, `safe` is Voted,
 * `finalized` is Finalized (MONAD.md). All three are read concurrently, because
 * reading them in sequence would measure our own round trips rather than the
 * chain's finality. Measured on this network, finalized trails latest by 2-3
 * blocks — roughly 600-850ms — which is the gap this pill exists to show.
 */

const LABELS: Record<(typeof COMMIT_STATES)[number], string> = {
  latest: "Proposed",
  safe: "Voted",
  finalized: "Finalized",
};

type Props = {
  /**
   * Block the transaction landed in. Omit it and the pill tracks the current head
   * instead, which is what `?debug=CHECKED_IN` needs to be screenshot-able without
   * running a real check-in.
   */
  blockNumber?: bigint;
};

export function CommitPill({ blockNumber: given }: Props) {
  const [resolved, setResolved] = useState<bigint | null>(given ?? null);

  useEffect(() => {
    if (given !== undefined) {
      setResolved(given);
      return;
    }
    let cancelled = false;
    publicClient
      .getBlockNumber({ cacheTime: 0 })
      .then((n) => {
        if (!cancelled) setResolved(n);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [given]);

  if (resolved === null) {
    return (
      <div className="commitPill">
        <div className="commitDots">
          <span className="commitDot" />
          <span className="commitDot" />
          <span className="commitDot" />
        </div>
        <span className="commitLabel">waiting for a block…</span>
      </div>
    );
  }

  return <CommitPillInner blockNumber={resolved} />;
}

function CommitPillInner({ blockNumber }: { blockNumber: bigint }) {
  const [reached, setReached] = useState<Record<string, number | null>>({
    latest: null,
    safe: null,
    finalized: null,
  });
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    startedAt.current = Date.now();
    setReached({ latest: null, safe: null, finalized: null });

    async function poll() {
      if (cancelled) return;
      try {
        // Concurrent on purpose: three sequential reads would add ~800ms of our
        // own latency to a number meant to describe the chain.
        // getBlockNumber has no blockTag; the tags live on getBlock.
        const [latest, safe, finalized] = (
          await Promise.all(
            COMMIT_STATES.map((tag) =>
              publicClient.getBlock({ blockTag: tag, includeTransactions: false }),
            ),
          )
        ).map((b) => b.number ?? 0n);

        if (cancelled) return;
        const elapsed = Date.now() - startedAt.current;

        setReached((prev) => ({
          latest: prev.latest ?? (latest >= blockNumber ? elapsed : null),
          safe: prev.safe ?? (safe >= blockNumber ? elapsed : null),
          finalized: prev.finalized ?? (finalized >= blockNumber ? elapsed : null),
        }));
      } catch {
        // A dropped poll is not worth surfacing; the next one will land.
      }
    }

    void poll();
    const timer = setInterval(() => void poll(), 300);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [blockNumber]);

  const done = reached.finalized !== null;

  return (
    <div className="commitPill" aria-live="polite">
      <div className="commitDots">
        {COMMIT_STATES.map((tag) => (
          <span
            key={tag}
            className={`commitDot${reached[tag] !== null ? " commitDotOn" : ""}`}
            title={LABELS[tag]}
            aria-label={`${LABELS[tag]}${reached[tag] !== null ? " reached" : " pending"}`}
          />
        ))}
      </div>

      <span className="commitLabel">
        {done ? "Finalized" : reached.safe !== null ? "Voted" : "Proposed"}
      </span>

      <span className="mono commitMs">
        {reached.finalized !== null
          ? `${reached.finalized}ms to finality`
          : `block ${blockNumber.toString()}`}
      </span>
    </div>
  );
}
