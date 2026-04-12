export interface ApiResponse<T> {
  error: boolean;
  message: string;
  data: T | null;
  code?: string;
}

export type ProjectDetail = {
  id: string;
  title: string;
  // description: string | null;
  initialPrompt: string;
  status: "PENDING" | "GENERATING" | "ACTIVE" | "ARCHIVED";
  // canvasState: unknown;
  // thumbnailUrl: string | null;
  // generations: Array<{
  //   id: string;
  //   model: string;
  //   spec: unknown;
  //   screens: unknown;
  //   createdAt: string;
  // }>;
  // createdAt: string;
  // updatedAt: string;
};

export type ProjectSummary = {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  updatedAt: string;
};
