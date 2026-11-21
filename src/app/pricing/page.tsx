import type { Metadata } from "next";
import { Pricing } from "@/components/Pricing";

export const metadata: Metadata = { title: "Pricing · InterviewAI" };

export default function PricingPage() {
  return <Pricing />;
}
