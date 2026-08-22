"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import type { Hex } from "viem";

/**
 * Reads the venue screen.
 *
 * Two decoders. `BarcodeDetector` is native, hardware-accelerated and present in
 * Chrome on Android — which is the demo device — so it is tried first. jsQR is the
 * fallback for iOS Safari and desktop, decoding from a canvas. The window is about
 * a second, so decode latency is not a detail.
 *
 * No WebGL background runs on this route (DESIGN.md §6): a shader next to
 * getUserMedia stutters the preview and eats the battery the demo depends on.
 */

const BYTES32 = /^0x[\da-fA-F]{64}$/;

type Props = {
  onChallenge: (challenge: Hex) => void;
  /** Set while a check-in is in flight, so we stop firing repeatedly. */
  paused?: boolean;
};

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

export function Scanner({ onChallenge, paused }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const firedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    let detector: BarcodeDetectorLike | null = null;

    function handle(raw: string) {
      const value = raw.trim();
      if (!BYTES32.test(value) || firedRef.current) return;
      firedRef.current = true;
      onChallenge(value as Hex);
    }

    async function tick() {
      if (cancelled) return;
      const video = videoRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !paused) {
        try {
          if (detector) {
            const found = await detector.detect(video);
            if (found[0]?.rawValue) handle(found[0].rawValue);
          } else {
            const canvas = canvasRef.current;
            const context = canvas?.getContext("2d", { willReadFrequently: true });
            if (canvas && context) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const image = context.getImageData(0, 0, canvas.width, canvas.height);
              const found = jsQR(image.data, image.width, image.height, {
                inversionAttempts: "dontInvert",
              });
              if (found?.data) handle(found.data);
            }
          }
        } catch {
          // A single dropped frame is not worth surfacing; keep scanning.
        }
      }

      raf = requestAnimationFrame(() => void tick());
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play();
        }

        const Detector = (
          globalThis as unknown as {
            BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike;
          }
        ).BarcodeDetector;
        if (Detector) {
          try {
            detector = new Detector({ formats: ["qr_code"] });
          } catch {
            detector = null;
          }
        }

        void tick();
      } catch (cause) {
        setError(
          cause instanceof Error && /denied|NotAllowed/i.test(cause.message)
            ? "Camera permission was denied. Allow it and try again."
            : "Could not open the camera. HTTPS is required for camera access.",
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onChallenge, paused]);

  if (error) {
    return <span className="warn">{error}</span>;
  }

  return (
    <>
      <video ref={videoRef} muted playsInline aria-label="Camera viewfinder" />
      <canvas ref={canvasRef} hidden />
    </>
  );
}
