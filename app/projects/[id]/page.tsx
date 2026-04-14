import { notFound } from "next/navigation";

import ProjectStudioClient from "@/components/projects/ProjectStudioClient";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

const PROJECT_ID_PATTERN = /^c[a-z0-9]{24}$/;

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  if (!id || !PROJECT_ID_PATTERN.test(id)) {
    notFound();
  }

  return <ProjectStudioClient projectId={id} />;
}
