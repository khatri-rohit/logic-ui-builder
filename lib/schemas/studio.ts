import { z } from "zod";
import {
  FEEDBACK_ALLOWED_ATTACHMENT_MIME_TYPES,
  FEEDBACK_MAX_ATTACHMENTS,
  FEEDBACK_MAX_FILE_SIZE_BYTES,
  FEEDBACK_MAX_TOTAL_ATTACHMENT_SIZE_BYTES,
  formatBytes,
} from "@/lib/feedback";

const projectIdSchema = z.string().cuid();
const feedbackAllowedAttachmentTypeSet: ReadonlySet<string> = new Set(
  FEEDBACK_ALLOWED_ATTACHMENT_MIME_TYPES,
);
const feedbackTextSchema = z.string().trim().min(1).max(10000);

const feedbackAttachmentFileSchema = z
  .instanceof(File, { message: "Attachment must be a file" })
  .refine((file) => file.size > 0, {
    message: "Attachment must not be empty",
  })
  .refine((file) => file.size <= FEEDBACK_MAX_FILE_SIZE_BYTES, {
    message: `Each attachment must be at most ${formatBytes(FEEDBACK_MAX_FILE_SIZE_BYTES)}`,
  })
  .refine((file) => feedbackAllowedAttachmentTypeSet.has(file.type), {
    message: "Only image and video files are allowed",
  });

const feedbackQueuedAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z
    .string()
    .trim()
    .min(1)
    .refine((value) => feedbackAllowedAttachmentTypeSet.has(value), {
      message: "Unsupported attachment type",
    }),
  contentBase64: z.string().trim().min(1),
  size: z.number().int().positive().max(FEEDBACK_MAX_FILE_SIZE_BYTES),
});

function addFeedbackAttachmentTotalSizeValidation(
  attachments: Array<{ size: number }>,
  ctx: z.RefinementCtx,
) {
  const totalAttachmentSize = attachments.reduce(
    (sum, attachment) => sum + attachment.size,
    0,
  );

  if (totalAttachmentSize > FEEDBACK_MAX_TOTAL_ATTACHMENT_SIZE_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["attachments"],
      message: `Total attachment size must be at most ${formatBytes(FEEDBACK_MAX_TOTAL_ATTACHMENT_SIZE_BYTES)}`,
    });
  }
}

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
  stylingLib: z.enum(["css", "tailwind"]),
  layoutDensity: z.enum(["comfortable", "compact"]),
  components: z.array(z.string()),
  // Design DNA — optional for backward compat with existing persisted specs
  visualPersonality: z
    .enum([
      "corporate-precision",
      "editorial-bold",
      "minimal-utility",
      "expressive-brand",
      "data-dense",
      "conversational-warm",
    ])
    .optional(),
  dominantLayoutPattern: z
    .enum([
      "full-page-sections",
      "dashboard-grid",
      "sidebar-content",
      "centered-focused",
      "split-screen",
      "data-table-primary",
    ])
    .optional(),
  typographyAuthority: z
    .enum(["display-driven", "body-balanced", "data-first", "label-dominant"])
    .optional(),
  spacingPhilosophy: z.enum(["airy", "balanced", "dense"]).optional(),
  primaryInteraction: z
    .enum(["read", "navigate", "input", "browse", "monitor"])
    .optional(),
  keyEmotionalTone: z.string().optional(),
  contentDensityScore: z.number().int().min(1).max(5).optional(),
});

export const generationRequestBodySchema = z.object({
  projectId: projectIdSchema,
  prompt: z.string().trim().min(1).max(10000),
  platform: generationPlatformSchema.optional(),
  model: z.string().trim().min(1).max(80).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
  // Optional frame and generation IDs for regeneration requests; ignored for new generations
  frameId: z.string().optional(),
  generationId: z.string().cuid().optional(),
  targetFrameId: z.string().optional(),
});

export const frameRegenerateRequestBodySchema = z.object({
  projectId: projectIdSchema,
  generationId: z.string().cuid().optional(),
  prompt: z.string().trim().min(1).max(10000).optional(),
  model: z.string().trim().min(1).max(80).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
  targetFrameId: z.string().optional(),
});

export const projectRouteParamsSchema = z.object({
  id: projectIdSchema,
});

export const feedbackBodySchema = z.object({
  feedback: feedbackTextSchema,
});

export const feedbackFormBodySchema = z
  .object({
    feedback: feedbackTextSchema,
    attachments: z
      .array(feedbackAttachmentFileSchema)
      .max(FEEDBACK_MAX_ATTACHMENTS)
      .default([]),
  })
  .superRefine((value, ctx) => {
    addFeedbackAttachmentTotalSizeValidation(value.attachments, ctx);
  });

export const feedbackQueuedJobBodySchema = z
  .object({
    feedback: feedbackTextSchema,
    attachments: z
      .array(feedbackQueuedAttachmentSchema)
      .max(FEEDBACK_MAX_ATTACHMENTS)
      .default([]),
  })
  .superRefine((value, ctx) => {
    addFeedbackAttachmentTotalSizeValidation(value.attachments, ctx);
  });

export type FeedbackQueuedAttachment = z.infer<
  typeof feedbackQueuedAttachmentSchema
>;

export type FeedbackQueuedJobBody = z.infer<typeof feedbackQueuedJobBodySchema>;

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
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    status: projectStatusSchema.optional(),
    canvasState: canvasSnapshotSchema.nullish(),
    generationId: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.status !== undefined ||
      value.canvasState !== undefined,
    {
      message: "At least one project field must be provided",
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
