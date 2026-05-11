import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ProjectStudioClient from "@/components/projects/ProjectStudioClient";
import { ProjectStudioStoreProvider } from "@/providers/project-studio-provider";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

const PROJECT_ID_PATTERN = /^c[a-z0-9]{24}$/;

export const metadata: Metadata = {
  title: "Design Studio",
  description:
    "A powerful design tool for creating stunning websites with ease.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  if (!id || !PROJECT_ID_PATTERN.test(id)) {
    notFound();
  }

  return (
    <ProjectStudioStoreProvider>
      <ProjectStudioClient projectId={id} />
    </ProjectStudioStoreProvider>
  );
}
