import type { Metadata, Viewport } from "next";
import "@noshow/react/styles.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "No-Show",
  description: "Deposit-free RSVP with on-chain proof of attendance.",
};

// Locked so a stray double-tap during check-in cannot zoom the camera view.
export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
