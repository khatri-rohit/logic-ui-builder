export interface ApiResponse<T> {
  error: boolean;
  message: string;
  data: T | null;
  code?: string;
}

export type ProjectDetail = {
  id: string;
  title: string;
  initialPrompt: string;
  status: "PENDING" | "GENERATING" | "ACTIVE" | "ARCHIVED";
  canvasState: unknown | null;
};

export type ProjectSummary = {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  updatedAt: string;
};
