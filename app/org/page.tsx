import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import OrgPageClient from "./OrgPageClient";

export const metadata: Metadata = {
  title: "Organisation Settings | LOGIC",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrgPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return <OrgPageClient currentUserId={userId} />;
}
