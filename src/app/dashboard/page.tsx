import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = { title: "Progress dashboard · InterviewAI" };

export default function DashboardPage() {
  return <Dashboard />;
}
