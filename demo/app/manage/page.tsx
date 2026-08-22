import type { Metadata } from "next";
import { ManagePage } from "@/components/ManagePage";

export const metadata: Metadata = {
  title: "No-Show — manage",
};

export default function Manage() {
  return <ManagePage />;
}
