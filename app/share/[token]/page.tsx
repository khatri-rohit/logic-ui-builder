import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicProjectViewer from "@/components/projects/PublicProjectViewer";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { token } = await params;

  if (!token || token.length < 16) {
    return {
      title: "Shared Project | LOGIC",
      robots: { index: false, follow: false },
    };
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/share/${token}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return {
        title: "Shared Project | LOGIC",
        robots: { index: false, follow: false },
      };
    }

    const payload = (await response.json()) as {
      data?: { title?: string | null; description?: string | null };
    };
    const project = payload.data;

    return {
      title: project?.title
        ? `${project.title} | Shared Project`
        : "Shared Project | LOGIC",
      description:
        project?.description ?? "View this UI/UX project shared on LOGIC.",
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: "Shared Project | LOGIC",
      robots: { index: false, follow: false },
    };
  }
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;

  if (!token || token.length < 16) {
    notFound();
  }

  return <PublicProjectViewer token={token} />;
}
