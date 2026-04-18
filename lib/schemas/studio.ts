import { z } from "zod";

const projectIdSchema = z.string().cuid();

const frameStateSchema = z.enum([
  "skeleton",
  "streaming",
  "compiling",
  "done",
  "error",
]);

export const generationPlatformSchema = z.enum(["web", "mobile"]);

export const projectStatusSchema = z.enum([
  "PENDING",
  "GENERATING",
  "ACTIVE",
  "ARCHIVED",
]);

export const generationStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);

export const canvasCameraSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  k: z.number().positive(),
});

export const persistedGenerationScreenSchema = z.object({
  id: z.string().min(1),
  state: frameStateSchema,
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().positive(),
  h: z.number().positive(),
  screenName: z.string().min(1),
  content: z.string(),
  editedContent: z.string().nullable(),
  error: z.string().nullable(),
});

export const canvasFrameSnapshotSchema = persistedGenerationScreenSchema.extend(
  {
    generationId: z.string().min(1),
    platform: generationPlatformSchema,
  },
);

export const canvasStateMetadataSchema = z.object({
  version: z.literal(1),
  camera: canvasCameraSchema,
  activeFrameId: z.string().nullable(),
  selectedFrameId: z.string().nullable(),
  selectedGenerationId: z.string().nullable().default(null),
  savedAt: z.string().datetime({ offset: true }),
});

export const canvasSnapshotSchema = canvasStateMetadataSchema.extend({
  frames: z.array(canvasFrameSnapshotSchema),
});

export const webAppSpecSchema = z.object({
  screens: z.array(z.string().min(1)).min(1),
  navPattern: z.enum(["top-nav", "sidebar", "hybrid", "none"]),
  platform: generationPlatformSchema,
  colorMode: z.enum(["dark", "light"]),
  primaryColor: z.string().min(1),
  accentColor: z.string().min(1),
  stylingLib: z.enum(["css", "tailwind", "shadcn"]),
  layoutDensity: z.enum(["comfortable", "compact"]),
  components: z.array(z.string()),
});

export const generationRequestBodySchema = z.object({
  projectId: projectIdSchema,
  prompt: z.string().trim().min(1).max(10000),
  platform: generationPlatformSchema.optional(),
  model: z.string().trim().min(1).max(80).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export const projectRouteParamsSchema = z.object({
  id: projectIdSchema,
});

export const feedbackBodySchema = z.object({
  feedback: z.string().trim().min(1).max(10000),
});

export const projectMetadataJobBodySchema = z.object({
  projectId: projectIdSchema.optional(),
  prompt: z.string().trim().min(1).max(10000),
});

export const createProjectBodySchema = z.object({
  prompt: z.string().trim().min(1).max(10000),
  platform: generationPlatformSchema.optional(),
});

export const projectPatchBodySchema = z
  .object({
    status: projectStatusSchema.optional(),
    canvasState: canvasSnapshotSchema.nullish(),
    generationId: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.canvasState !== undefined,
    {
      message: "Either status or canvasState must be provided",
      path: ["status"],
    },
  );

export const projectGenerationSchema = z.object({
  generationId: z.string().min(1),
  model: z.string().min(1),
  platform: generationPlatformSchema,
  spec: webAppSpecSchema.nullable(),
  screens: z.array(persistedGenerationScreenSchema),
  status: generationStatusSchema,
  terminalAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export function toValidationIssues(error: z.ZodError) {
  const flattened = error.flatten();
  return {
    formErrors: flattened.formErrors,
    fieldErrors: flattened.fieldErrors,
  };
}
