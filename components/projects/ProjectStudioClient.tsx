"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JetBrains_Mono } from "next/font/google";

import { StudioCanvasSurface } from "@/components/canvas/StudioCanvasSurface";
import { InfiniteCanvasHandle } from "@/components/canvas/InfiniteCanvas";
import { StudioShell } from "@/components/canvas/StudioShell";
import {
  readCanvasTransform,
  useCanvasPersist,
} from "@/components/canvas/hooks/useCanvasPersist";
import { usePointerMode } from "@/components/canvas/hooks/usePointerMode";
import { useStudioFrames } from "@/components/canvas/hooks/useStudioFrames";
import { CanvasFrameData } from "@/components/canvas/types";
import { Button } from "@/components/ui/button";
import { StudioHeader } from "@/components/projects/StudioHeader";
import { StudioPromptBar } from "@/components/projects/StudioPromptBar";
import { StudioStatusBar } from "@/components/projects/StudioStatusBar";
import { useGenerationSession } from "@/components/projects/hooks/useGenerationSession";
import { readResponseErrorMessage } from "@/lib/generation/responseError";
import {
  useProjectCanvasStateUpdateMutation,
  useProjectDeleteMutation,
  useProjectMetadataUpdateMutation,
  useProjectQuery,
  useProjectShareToggleMutation,
  useProjectThumbnailUpdateMutation,
  useRestoreFrameVersionMutation,
} from "@/lib/projects/queries";
import { shouldAutoStartProjectGeneration } from "@/lib/projects/autoStart";
import { useUsageQuery } from "@/lib/billing/queries";
import { FrameHistoryPanel } from "@/components/projects/FrameHistoryPanel";
import {
  useProjectStudioStore,
  useProjectStudioStoreApi,
} from "@/providers/project-studio-provider";
import { Check, Code2, Copy, Link, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProjectStudioRuntimeState } from "@/stores/project-studio";

import { CanvasSnapshotV1 } from "@/lib/canvas-state";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";
import FeedbackForm from "./FeedbackForm";
import { toast } from "sonner";
import JSZip from "jszip";
import * as htmlToImage from "html-to-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

type ProjectActionId =
  | "all-projects"
  | "share"
  | "download"
  | "export-png"
  | "edit"
  | "delete"
  | "feedback";

interface ProjectStudioClientProps {
  projectId: string;
}

const MAX_PROMPT_HEIGHT = 220;

function normalizePosition(value: number) {
  return Math.round(value * 100) / 100;
}

function slugifyFileName(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getSafeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

const ProjectStudioClient = ({ projectId }: ProjectStudioClientProps) => {
  const router = useRouter();

  const {
    data: project,
    isLoading: projectLoading,
    isError,
    error: projectError,
    refetch: refetchProject,
  } = useProjectQuery(projectId);

  const { data: usage } = useUsageQuery();

  const [canvasSaveMessage, setCanvasSaveMessage] = useState<string | null>(
    null,
  );

  const { mutate: persistCanvasState } = useProjectCanvasStateUpdateMutation({
    onConflict: () => {
      setCanvasSaveMessage("Canvas sync conflict detected. Retrying save...");
    },
    onPersisted: () => {
      setCanvasSaveMessage(null);
    },
    onError: () => {
      setCanvasSaveMessage(
        "Unable to save canvas changes right now. Changes may not persist yet.",
      );
    },
  });
  const {
    mutate: deleteProject,
    data: deleteProjectData,
    error: deleteError,
    isSuccess: isDeleteSuccess,
  } = useProjectDeleteMutation();
  const { mutateAsync: updateProjectThumbnail } =
    useProjectThumbnailUpdateMutation();
  const { mutateAsync: updateProjectMetadata, isPending: isSavingMetadata } =
    useProjectMetadataUpdateMutation();

  const platform = project?.platform ?? "web";

  type ThemeMode = "light" | "dark" | "system";
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    return (
      (localStorage.getItem("project-studio-theme") as ThemeMode) || "dark"
    );
  });
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isDark = themeMode === "dark" || (themeMode === "system" && systemDark);

  const handleThemeChange = useCallback((next: ThemeMode) => {
    setThemeMode(next);
    localStorage.setItem("project-studio-theme", next);
  }, []);

  const projectStudioStoreApi = useProjectStudioStoreApi();

  const hydrateStudioState = useProjectStudioStore(
    (state) => state.hydrateFromProject,
  );
  const setStudioFrames = useProjectStudioStore(
    (state) => state.setStudioFrames,
  );
  const setRuntimeHydrated = useProjectStudioStore(
    (state) => state.setRuntimeHydrated,
  );
  const hasHydratedCanvas = useProjectStudioStore(
    (state) => state.runtime.hasHydratedCanvas,
  );
  const hasInitiatedGeneration = useProjectStudioStore(
    (state) => state.runtime.hasInitiatedGeneration,
  );
  const setStudioSelectedGenerationId = useProjectStudioStore(
    (state) => state.setSelectedGenerationId,
  );

  const studio = projectStudioStoreApi.getState().studio;

  const canvasRef = useRef<InfiniteCanvasHandle | null>(null);
  const domRef = useRef<HTMLDivElement | null>(null);
  const isUploadingThumbnailRef = useRef(false);
  const commandInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [prompt, setPrompt] = useState("");
  const [generationMode, setGenerationMode] = useState<
    "generate" | "regenerate"
  >("generate");
  const [openFeedbackForm, setOpenFeedbackForm] = useState(false);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [metadataTitle, setMetadataTitle] = useState("");
  const [metadataDescription, setMetadataDescription] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  const { mutate: toggleProjectShare, isPending: isTogglingShare } =
    useProjectShareToggleMutation();
  const [codeEditorOpen, setCodeEditorOpen] = useState(false);
  const [codeEditorValue, setCodeEditorValue] = useState("");
  const [historyPanelFrameId, setHistoryPanelFrameId] = useState<string | null>(
    null,
  );
  const { mutate: restoreFrameVersion, isPending: isRestoring } =
    useRestoreFrameVersionMutation();

  const {
    frameList,
    frameRects,
    replaceAll,
    updateEphemeral,
    commit,
    beginGesture,
    endGesture,
    undo,
    redo,
    canUndo,
    canRedo,
    getFramesSnapshot,
  } = useStudioFrames({
    onSync: (nextFrames) => {
      setStudioFrames(nextFrames);
    },
  });

  /** Compatibility shim: streaming/ephemeral vs discrete commits. */
  const applyFrames = useCallback(
    (
      updater: (
        current: Map<string, CanvasFrameData>,
      ) => Map<string, CanvasFrameData>,
      skipHistory = false,
    ) => {
      if (skipHistory) {
        updateEphemeral(updater);
      } else {
        commit(updater);
      }
    },
    [commit, updateEphemeral],
  );

  const {
    activeFrameId,
    selectedFrameId,
    setSelectedFrameId,
    enterFrame,
    exitFrame,
    deselect,
    openEditor,
    closeEditor,
  } = usePointerMode();

  const handleCanvasEmptyPointerDown = useCallback(() => {
    if (activeFrameId) {
      exitFrame();
    }
    deselect();
  }, [activeFrameId, deselect, exitFrame]);

  const canRegenerate = usage?.frameRegenerationEnabled ?? false;
  const canEditCode = usage?.planId != null && usage.planId !== "FREE";

  const getStudioRuntime = useCallback(
    () => projectStudioStoreApi.getState().runtime,
    [projectStudioStoreApi],
  );

  const updateStudioRuntime = useCallback(
    (
      updater: (
        runtime: ProjectStudioRuntimeState,
      ) => ProjectStudioRuntimeState,
    ) => {
      projectStudioStoreApi.getState().updateRuntime(updater);
    },
    [projectStudioStoreApi],
  );

  const setActiveGenerationContext = useCallback(
    (generationId: string | null) => {
      updateStudioRuntime((runtime) => ({
        ...runtime,
        activeGenerationId: generationId,
      }));
      setStudioSelectedGenerationId(generationId);
    },
    [setStudioSelectedGenerationId, updateStudioRuntime],
  );

  const resolvePersistGenerationId = useCallback(
    (generationId?: string) => {
      const { runtime, studio } = projectStudioStoreApi.getState();

      return (
        generationId ??
        runtime.activeGenerationId ??
        studio?.selectedGenerationId ??
        undefined
      );
    },
    [projectStudioStoreApi],
  );

  const { scheduleSnapshotPersist, flushPendingSnapshotPersist } =
    useCanvasPersist({
      projectId,
      hasHydratedCanvas: () => getStudioRuntime().hasHydratedCanvas,
      getFramesSnapshot,
      getCanvasTransform: () => readCanvasTransform(canvasRef),
      getSelection: () => ({ activeFrameId, selectedFrameId }),
      getSelectedGenerationId: () =>
        projectStudioStoreApi.getState().studio?.selectedGenerationId ?? null,
      resolvePersistGenerationId,
      persistCanvasState,
    });

  const onCapture = useCallback(async () => {
    if (isUploadingThumbnailRef.current) {
      return;
    }

    isUploadingThumbnailRef.current = true;
    try {
      const url = new URL(
        `/projects/${projectId}`,
        window.location.origin,
      ).toString();

      const response = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, url }),
      });

      if (!response.ok) {
        throw new Error(await readResponseErrorMessage(response));
      }

      const thumbnailBlob = await response.blob();
      if (thumbnailBlob.size === 0) {
        throw new Error("Capture API returned an empty screenshot.");
      }

      await updateProjectThumbnail({
        id: projectId,
        thumbnail: thumbnailBlob,
      });
      logger.info("Project thumbnail updated via Puppeteer.", { projectId });
    } catch (error) {
      logger.error("Failed to capture and upload project thumbnail:", error);
      toast.error("Thumbnail capture failed", {
        description:
          error instanceof Error
            ? error.message
            : "The project preview could not be captured.",
      });
    } finally {
      isUploadingThumbnailRef.current = false;
    }
  }, [projectId, updateProjectThumbnail]);

  const {
    isGenerating,
    activeStreamingScreen,
    generationErrorMessage,
    generationRecoveryPrompt,
    setGenerationErrorMessage,
    setGenerationRecoveryPrompt,
    handleGenerate,
    handleFrame,
    resumeAfterHydrate,
  } = useGenerationSession({
    projectId,
    project,
    platform,
    prompt,
    setPrompt,
    generationMode,
    activeFrameId,
    applyFrames,
    updateEphemeral,
    getFramesSnapshot,
    scheduleSnapshotPersist,
    flushPendingSnapshotPersist,
    canvasRef,
    onCapture,
    onQuotaExceeded: (message) => {
      toast.error("Generation quota reached", {
        description: message,
        action: {
          label: "Upgrade",
          onClick: () => router.push("/billing/upgrade"),
        },
      });
    },
  });

  const canGenerate =
    !isGenerating &&
    (!!prompt.trim() || (generationMode === "regenerate" && !!activeFrameId));

  const restoreFromSnapshot = useCallback(
    (snapshot: CanvasSnapshotV1) => {
      const restoredFrames = new Map<string, CanvasFrameData>(
        snapshot.frames.map((frame) => [frame.id, frame]),
      );

      replaceAll(restoredFrames, { pushHistory: true });
      const restoredFrameIds: Record<string, string[]> = {};
      for (const frame of snapshot.frames) {
        const frameIds = restoredFrameIds[frame.screenName] ?? [];
        frameIds.push(frame.id);
        restoredFrameIds[frame.screenName] = frameIds;
      }
      updateStudioRuntime((runtime) => ({
        ...runtime,
        frameIdsByScreen: restoredFrameIds,
        activeFrameIdsByScreen: {},
      }));

      setSelectedFrameId(snapshot.selectedFrameId ?? null);
      if (snapshot.activeFrameId) {
        enterFrame(snapshot.activeFrameId);
      } else {
        exitFrame();
      }

      requestAnimationFrame(() => {
        canvasRef.current?.setTransform(snapshot.camera);
      });
    },
    [
      enterFrame,
      exitFrame,
      replaceAll,
      setSelectedFrameId,
      updateStudioRuntime,
    ],
  );

  const handlePreviewFailed = useCallback(
    (frameId: string) => {
      applyFrames((current) => {
        const frame = current.get(frameId);
        if (!frame || frame.state === "error") return current;

        const next = new Map(current);
        next.set(frameId, {
          ...frame,
          state: "error",
          error: frame.error ?? "Preview failed to render.",
        });
        return next;
      });
      scheduleSnapshotPersist();
    },
    [applyFrames, scheduleSnapshotPersist],
  );

  const handleMoveFrame = useCallback(
    (id: string, nextX: number, nextY: number) => {
      applyFrames((current) => {
        const frame = current.get(id);
        if (!frame) return current;

        const normalizedX = normalizePosition(nextX);
        const normalizedY = normalizePosition(nextY);

        if (frame.x === normalizedX && frame.y === normalizedY) {
          return current;
        }

        const next = new Map(current);
        next.set(id, {
          ...frame,
          x: normalizedX,
          y: normalizedY,
        });
        return next;
      }, true);
    },
    [applyFrames],
  );

  const handleResizeFrame = useCallback(
    (id: string, nextW: number, nextH: number) => {
      applyFrames((current) => {
        const frame = current.get(id);
        if (!frame) return current;

        if (frame.w === nextW && frame.h === nextH) {
          return current;
        }

        const next = new Map(current);
        next.set(id, {
          ...frame,
          w: nextW,
          h: nextH,
        });
        return next;
      }, true);
    },
    [applyFrames],
  );

  const handleAutoFitFrame = useCallback(
    (id: string, nextW: number, nextH: number) => {
      applyFrames((current) => {
        const frame = current.get(id);
        if (!frame) return current;

        if (frame.w === nextW && frame.h === nextH) {
          return current;
        }

        const next = new Map(current);
        next.set(id, {
          ...frame,
          w: nextW,
          h: nextH,
        });
        return next;
      });

      scheduleSnapshotPersist();
    },
    [applyFrames, scheduleSnapshotPersist],
  );

  const handleInteractionStart = useCallback(() => {
    beginGesture();
  }, [beginGesture]);

  const handleInteractionEnd = useCallback(() => {
    endGesture();
    scheduleSnapshotPersist();
  }, [endGesture, scheduleSnapshotPersist]);

  const handleTransformChange = useCallback(() => {
    scheduleSnapshotPersist();
  }, [scheduleSnapshotPersist]);

  const handleDownloadProject = useCallback(async () => {
    const doneFrames = [...getFramesSnapshot().values()].filter(
      (frame) =>
        frame.state === "done" && (frame.editedContent ?? frame.content),
    );

    if (doneFrames.length === 0) {
      toast.error("No completed frames to download yet.");
      return;
    }

    try {
      const zip = new JSZip();
      const src = zip.folder("src");
      const screens = src?.folder("screens");
      const fileNames = new Map<string, string>();

      doneFrames.forEach((frame, index) => {
        const baseName = slugifyFileName(
          frame.screenName,
          `screen-${index + 1}`,
        );
        let fileName = `${baseName}.tsx`;
        let suffix = 2;
        while (fileNames.has(fileName)) {
          fileName = `${baseName}-${suffix}.tsx`;
          suffix += 1;
        }
        fileNames.set(fileName, frame.id);
        screens?.file(fileName, frame.editedContent ?? frame.content);
      });

      const imports = [...fileNames.keys()]
        .map((fileName, index) => {
          const componentName = `Screen${index + 1}`;
          return `import ${componentName} from "./screens/${fileName.replace(/\.tsx$/, "")}";`;
        })
        .join("\n");

      const navItems = doneFrames
        .map(
          (frame, index) =>
            `{ id: "screen-${index + 1}", label: ${JSON.stringify(frame.screenName)}, Component: Screen${index + 1} }`,
        )
        .join(",\n  ");

      src?.file(
        "App.tsx",
        `${imports}

const screens = [
  ${navItems}
];

export default function App() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <nav className="sticky top-0 z-10 flex gap-2 border-b border-white/10 bg-neutral-950/90 px-4 py-3 backdrop-blur">
        {screens.map((screen) => (
          <a key={screen.id} href={\`#\${screen.id}\`} className="rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-white/10 hover:text-white">
            {screen.label}
          </a>
        ))}
      </nav>
      <div className="space-y-8 p-4">
        {screens.map(({ id, Component }) => (
          <section key={id} id={id} className="overflow-hidden rounded-lg border border-white/10 bg-white">
            <Component />
          </section>
        ))}
      </div>
    </main>
  );
}
`,
      );

      src?.file(
        "main.tsx",
        `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
      );

      src?.file(
        "styles.css",
        `@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}
`,
      );

      zip.file(
        "package.json",
        JSON.stringify(
          {
            scripts: {
              dev: "vite --host 0.0.0.0",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: {
              "@vitejs/plugin-react": "^5.0.0",
              vite: "^7.0.0",
              typescript: "^5.0.0",
              react: "19.2.4",
              "react-dom": "19.2.4",
              "lucide-react": "^0.577.0",
              recharts: "^2.10.0",
              clsx: "^2.1.1",
              "tailwind-merge": "^3.5.0",
              "date-fns": "^3.6.0",
              dayjs: "^1.11.0",
              lodash: "^4.17.21",
              tailwindcss: "^3.4.17",
              autoprefixer: "^10.4.20",
              postcss: "^8.4.49",
            },
            devDependencies: {},
          },
          null,
          2,
        ),
      );
      zip.file(
        "index.html",
        '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
      );
      zip.file(
        "tailwind.config.js",
        `export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`,
      );
      zip.file(
        "postcss.config.js",
        `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
      );
      zip.file(
        "README.md",
        `# ${project?.title || "LOGIC export"}

Generated from LOGIC. Run:

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
      );

      const blob = await zip.generateAsync({ type: "blob" });
      triggerBlobDownload(
        blob,
        `${slugifyFileName(project?.title || "logic-project", "logic-project")}.zip`,
      );
      toast.success("Project source downloaded");
    } catch (error) {
      logger.error("Project download failed", error);
      toast.error("Could not package this project.");
    }
  }, [getFramesSnapshot, project]);

  const handleExportPng = useCallback(async () => {
    const world = document.querySelector<HTMLElement>(
      '[data-canvas-capture="world"]',
    );

    if (!world || getFramesSnapshot().size === 0) {
      toast.error("No canvas frames to export.");
      return;
    }

    const placeholders: HTMLDivElement[] = [];

    try {
      world.querySelectorAll("iframe").forEach((iframe) => {
        const parent = iframe.parentElement;
        if (!parent) return;

        const placeholder = document.createElement("div");
        placeholder.textContent = "Preview iframe";
        placeholder.style.position = "absolute";
        placeholder.style.left = iframe.style.left || "0";
        placeholder.style.top = iframe.style.top || "0";
        placeholder.style.width = iframe.style.width || "100%";
        placeholder.style.height = iframe.style.height || "100%";
        placeholder.style.zIndex = "3";
        placeholder.style.display = "flex";
        placeholder.style.alignItems = "center";
        placeholder.style.justifyContent = "center";
        placeholder.style.background = "#f4f4f5";
        placeholder.style.color = "#52525b";
        placeholder.style.font = "600 12px system-ui";
        placeholder.style.border = "1px solid rgba(0,0,0,0.08)";
        parent.appendChild(placeholder);
        placeholders.push(placeholder);
      });

      const blob = await htmlToImage.toBlob(world, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#111111",
      });

      if (!blob) throw new Error("PNG export returned an empty blob.");

      triggerBlobDownload(
        blob,
        `${slugifyFileName(project?.title || "logic-canvas", "logic-canvas")}.png`,
      );
      toast.success("Canvas PNG exported", {
        description:
          "Iframe previews are represented with placeholders in browser exports.",
      });
    } catch (error) {
      logger.error("PNG export failed", error);
      toast.error("Could not export the canvas as PNG.");
    } finally {
      placeholders.forEach((placeholder) => placeholder.remove());
    }
  }, [getFramesSnapshot, project]);

  const openMetadataEditor = useCallback(() => {
    setMetadataTitle(project?.title || "Untitled Project");
    setMetadataDescription(project?.description || "");
    setMetadataDialogOpen(true);
  }, [
    project?.description,
    project?.title,
    setMetadataDescription,
    setMetadataDialogOpen,
    setMetadataTitle,
  ]);

  const saveProjectMetadata = useCallback(async () => {
    const title = metadataTitle.trim();
    if (!title) {
      toast.error("Project title is required.");
      return;
    }

    try {
      await updateProjectMetadata({
        id: projectId,
        title,
        description: metadataDescription.trim(),
      });
      toast.success("Project details updated");
      setMetadataDialogOpen(false);
    } catch (error) {
      logger.error("Project metadata update failed", error);
      toast.error("Could not update project details.");
    }
  }, [
    metadataDescription,
    metadataTitle,
    projectId,
    setMetadataDialogOpen,
    updateProjectMetadata,
  ]);

  const handleOpenCodeEditor = useCallback(
    (frameId: string) => {
      const frame = getFramesSnapshot().get(frameId);
      if (!frame) return;

      setSelectedFrameId(frameId);
      setCodeEditorValue(frame.editedContent ?? frame.content);
      setCodeEditorOpen(true);
      openEditor(frameId);
    },
    [getFramesSnapshot, openEditor, setCodeEditorValue, setSelectedFrameId],
  );

  const handleOpenHistory = useCallback(
    (frameId: string) => {
      setHistoryPanelFrameId(frameId);
    },
    [setHistoryPanelFrameId],
  );

  const handleLockedAction = useCallback(
    (feature: string) => {
      toast.error(`${feature} is a premium feature`, {
        description: "Upgrade to Standard or Pro to unlock this.",
        action: {
          label: "Upgrade",
          onClick: () => router.push("/billing/upgrade"),
        },
      });
    },
    [router],
  );

  const handleSaveCodeEditor = useCallback(() => {
    if (!activeFrameId) return;

    const generationId = getFramesSnapshot().get(activeFrameId)?.generationId;

    applyFrames((current) => {
      const frame = current.get(activeFrameId);
      if (!frame) return current;

      const next = new Map(current);
      next.set(activeFrameId, {
        ...frame,
        state: "done",
        editedContent: codeEditorValue,
        error: null,
      });
      return next;
    });

    scheduleSnapshotPersist(generationId);
    setCodeEditorOpen(false);
    closeEditor();
    toast.success("Frame code updated");
  }, [
    activeFrameId,
    applyFrames,
    closeEditor,
    codeEditorValue,
    getFramesSnapshot,
    scheduleSnapshotPersist,
  ]);

  const handleCloseCodeEditor = useCallback(
    (open: boolean) => {
      setCodeEditorOpen(open);
      if (!open) closeEditor();
    },
    [closeEditor],
  );

  function handleMenuClick(action: ProjectActionId) {
    switch (action) {
      case "all-projects":
        router.push("/");
        break;
      case "share":
        setShareDialogOpen(true);
        break;
      case "download":
        void handleDownloadProject();
        break;
      case "export-png":
        void handleExportPng();
        break;
      case "edit":
        openMetadataEditor();
        break;
      case "delete": {
        const confirmed = confirm(
          "Are you sure you want to delete this project? This action cannot be undone.",
        );
        if (confirmed) {
          deleteProject({ id: projectId });
        }
        break;
      }
      case "feedback": {
        setOpenFeedbackForm(true);
        break;
      }
      default:
        toast.error("Unknown action: " + action);
        break;
    }
  }

  const handleDelete = useCallback(
    (frameId: string) => {
      const frameToDelete = getFramesSnapshot().get(frameId);

      applyFrames((current) => {
        const frame = current.get(frameId);
        if (!frame) return current;
        const next = new Map(current);
        next.delete(frameId);
        return next;
      });

      updateStudioRuntime((runtime) => {
        const nextFrameIdsByScreen = { ...runtime.frameIdsByScreen };
        const screenName = frameToDelete?.screenName;
        if (screenName) {
          const frameIds = nextFrameIdsByScreen[screenName] ?? [];
          nextFrameIdsByScreen[screenName] = frameIds.filter(
            (id) => id !== frameId,
          );
        }
        return {
          ...runtime,
          frameIdsByScreen: nextFrameIdsByScreen,
          activeFrameIdsByScreen: Object.fromEntries(
            Object.entries(runtime.activeFrameIdsByScreen).filter(
              ([, id]) => id !== frameId,
            ),
          ),
        };
      });
      scheduleSnapshotPersist(frameToDelete?.generationId, {
        allowEmpty: true,
      });
    },
    [
      applyFrames,
      getFramesSnapshot,
      scheduleSnapshotPersist,
      updateStudioRuntime,
    ],
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Still allow Escape in inputs
        if (event.key === "Escape") {
          target.blur();
          deselect();
          setPrompt("");
        }
        return;
      }

      // Delete selected frame
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedFrameId &&
        !isGenerating
      ) {
        event.preventDefault();
        const frame = getFramesSnapshot().get(selectedFrameId);
        if (frame) {
          handleDelete(selectedFrameId);
          toast.info("Frame deleted");
        }
      }

      // Escape in canvas is handled by usePointerMode (exit → then deselect).
      // Do not clear selection here — that fights the Esc ladder.

      // Ctrl/Cmd + Enter to generate
      if (
        event.key === "Enter" &&
        (event.ctrlKey || event.metaKey) &&
        canGenerate &&
        !isGenerating
      ) {
        event.preventDefault();
        void handleGenerate();
      }

      // Ctrl/Cmd + Z to undo
      if (
        event.key === "z" &&
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        canUndo
      ) {
        event.preventDefault();
        undo();
      }

      // Ctrl/Cmd + Shift + Z (or Ctrl/Cmd + Y) to redo
      if (
        ((event.key === "z" && event.shiftKey) || event.key === "y") &&
        (event.ctrlKey || event.metaKey) &&
        canRedo
      ) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedFrameId,
    isGenerating,
    canGenerate,
    handleGenerate,
    undo,
    redo,
    canUndo,
    canRedo,
    deselect,
    handleDelete,
    getFramesSnapshot,
  ]);

  useEffect(() => {
    if (projectLoading || isError) return;

    if (!project) {
      logger.error("Project not found");
      return;
    }

    hydrateStudioState(project);

    const fallbackSelectedGenerationId =
      project.generations[project.generations.length - 1]?.generationId ?? null;

    const canvasSnapshot = project.canvasState
      ? ({
          ...project.canvasState,
          selectedGenerationId:
            project.canvasState.selectedGenerationId ??
            fallbackSelectedGenerationId,
          frames: project.frames,
        } as CanvasSnapshotV1)
      : project.frames.length > 0
        ? ({
            version: 1,
            camera: { x: 0, y: 0, k: 1 },
            activeFrameId: null,
            selectedFrameId: null,
            selectedGenerationId: fallbackSelectedGenerationId,
            savedAt: new Date().toISOString(),
            frames: project.frames,
          } as CanvasSnapshotV1)
        : null;

    const restoreComplete = !hasHydratedCanvas;
    if (restoreComplete) {
      if (canvasSnapshot) {
        restoreFromSnapshot(canvasSnapshot);
        setActiveGenerationContext(canvasSnapshot.selectedGenerationId);
      }
      setRuntimeHydrated(true);
    }

    resumeAfterHydrate(project, restoreComplete);
  }, [
    hasHydratedCanvas,
    hydrateStudioState,
    isError,
    project,
    projectError,
    projectLoading,
    restoreFromSnapshot,
    resumeAfterHydrate,
    setActiveGenerationContext,
    setRuntimeHydrated,
  ]);

  useEffect(() => {
    if (deleteProjectData?.error === false) {
      logger.info("Project deleted successfully:", deleteProjectData);
      router.push("/");
    }
  }, [deleteProjectData, deleteError, router, isDeleteSuccess]);

  useEffect(() => {
    return () => {
      flushPendingSnapshotPersist();
    };
  }, [flushPendingSnapshotPersist]);

  useEffect(() => {
    const promptInput = commandInputRef.current;

    if (!promptInput) {
      return;
    }

    promptInput.style.height = "0px";
    const nextHeight = Math.min(promptInput.scrollHeight, MAX_PROMPT_HEIGHT);
    promptInput.style.height = `${nextHeight}px`;
    promptInput.style.overflowY =
      promptInput.scrollHeight > MAX_PROMPT_HEIGHT ? "auto" : "hidden";
  }, [prompt]);

  if (projectLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div
          className={cn("text-xs uppercase tracking-[0.2em]", mono.className)}
        >
          Loading project...
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = getSafeErrorMessage(
      projectError,
      "Failed to load this project.",
    );

    return (
      <div className="flex h-screen w-full items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-xl rounded-md border border-input bg-card p-6">
          <h1
            className={cn(
              "text-sm uppercase tracking-[0.18em]",
              mono.className,
            )}
          >
            Unable to load project
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{errorMessage}</p>

          <div className="mt-5 flex items-center gap-2">
            <Button onClick={() => void refetchProject()} variant="secondary">
              Retry
            </Button>
            <Button onClick={() => router.push("/")} variant="ghost">
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-xl rounded-md border border-input bg-card p-6">
          <h1
            className={cn(
              "text-sm uppercase tracking-[0.18em]",
              mono.className,
            )}
          >
            Project not found
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This project may have been deleted or you no longer have access.
          </p>

          <div className="mt-5">
            <Button onClick={() => router.push("/")} variant="secondary">
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isPreparingFirstGeneration =
    isGenerating ||
    (!hasInitiatedGeneration && shouldAutoStartProjectGeneration(project));

  const themeVariables = isDark
    ? [
        "[--radius:2px] [--background:#111111] [--foreground:#e2e2e2]",
        "[--card:#1a1a1a] [--card-foreground:#e2e2e2] [--popover:#1a1a1a] [--popover-foreground:#f9f9f9]",
        "[--primary:#ffffff] [--primary-foreground:#000000] [--secondary:#1a1a1a] [--secondary-foreground:#f1f1f1]",
        "[--muted:#1a1a1a] [--muted-foreground:#777777] [--accent:#222222] [--accent-foreground:#f9f9f9]",
        "[--destructive:#ba1a1a] [--border:#222222] [--input:#333333] [--ring:#777777]",
        "[--canvas-background:#111111] [--canvas-dot:rgba(255,255,255,0.16)]",
        "[--frame-error-bg:#0f0f0f] [--frame-skeleton-bg:#1a1a1a]",
        "[--frame-border-default:rgba(255,255,255,0.10)] [--frame-border-selected:rgba(255,255,255,0.28)]",
        "[--frame-shadow:rgba(0,0,0,0.55)] [--status-bar-bg:black] [--status-bar-text:white]",
      ]
    : [
        "[--radius:2px] [--background:#fafafa] [--foreground:#171717]",
        "[--card:#ffffff] [--card-foreground:#171717] [--popover:#ffffff] [--popover-foreground:#171717]",
        "[--primary:#171717] [--primary-foreground:#fafafa] [--secondary:#f5f5f5] [--secondary-foreground:#171717]",
        "[--muted:#f5f5f5] [--muted-foreground:#737373] [--accent:#f5f5f5] [--accent-foreground:#171717]",
        "[--destructive:#ef4444] [--border:#e5e5e5] [--input:#e5e5e5] [--ring:#a3a3a3]",
        "[--canvas-background:#f5f5f5] [--canvas-dot:rgba(0,0,0,0.10)]",
        "[--frame-error-bg:#fafafa] [--frame-skeleton-bg:#f0f0f0]",
        "[--frame-border-default:rgba(0,0,0,0.10)] [--frame-border-selected:rgba(0,0,0,0.28)]",
        "[--frame-shadow:rgba(0,0,0,0.20)] [--status-bar-bg:#f0f0f0] [--status-bar-text:#171717]",
      ];

  return (
    <StudioShell
      className={cn(
        isDark && "dark",
        "relative h-screen w-full overflow-hidden",
        ...themeVariables,
      )}
    >
      <StudioCanvasSurface
        canvasRef={canvasRef}
        containerRef={domRef}
        frameList={frameList}
        frameRects={frameRects}
        activeFrameId={activeFrameId}
        selectedFrameId={selectedFrameId}
        isGenerating={isPreparingFirstGeneration}
        themeMode={themeMode}
        isDark={isDark}
        canRegenerate={canRegenerate}
        canEditCode={canEditCode}
        isSpacePressed={() => canvasRef.current?.isSpacePressed() ?? false}
        onFrameExit={exitFrame}
        onCanvasEmptyPointerDown={handleCanvasEmptyPointerDown}
        onTransformChange={handleTransformChange}
        onSelectFrame={(id) => {
          setSelectedFrameId(id);
          const frame = getFramesSnapshot().get(id);
          if (frame) {
            setStudioSelectedGenerationId(frame.generationId);
          }
        }}
        onActivateFrame={(id) => {
          setSelectedFrameId(id);
          enterFrame(id);
          const frame = getFramesSnapshot().get(id);
          if (frame) {
            setStudioSelectedGenerationId(frame.generationId);
          }
          scheduleSnapshotPersist();
        }}
        onMove={handleMoveFrame}
        onResize={handleResizeFrame}
        onAutoFit={handleAutoFitFrame}
        onInteractionStart={handleInteractionStart}
        onInteractionEnd={handleInteractionEnd}
        onRegenerate={handleFrame}
        onPreviewFailed={handlePreviewFailed}
        onDelete={handleDelete}
        onEditCode={handleOpenCodeEditor}
        onOpenHistory={handleOpenHistory}
        onLockedAction={handleLockedAction}
      />

      <StudioHeader
        title={project.title || "Untitled Project"}
        platform={platform}
        themeMode={themeMode}
        onThemeChange={handleThemeChange}
        onAction={handleMenuClick}
        canvasRef={domRef}
      />

      <StudioStatusBar
        platform={platform}
        isGenerating={isPreparingFirstGeneration}
        activeStreamingScreen={activeStreamingScreen}
        canvasSaveMessage={canvasSaveMessage}
        activeFrameId={activeFrameId}
        activeFrameName={
          studio?.frames.find((f) => f.id === activeFrameId)?.screenName || null
        }
      />

      <FeedbackForm
        open={openFeedbackForm}
        onOpenChange={setOpenFeedbackForm}
      />

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="size-4" />
              Share project
            </DialogTitle>
            <DialogDescription>
              Anyone with the link can view this project in read-only mode.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="public-share" className="text-sm font-medium">
                  Public sharing
                </Label>
                <p className="text-xs text-muted-foreground">
                  {project?.isPublic
                    ? "Anyone with the link can view this project"
                    : "Only you can view this project"}
                </p>
              </div>
              <Switch
                id="public-share"
                checked={project?.isPublic ?? false}
                disabled={isTogglingShare}
                onCheckedChange={() => {
                  if (!project) return;
                  toggleProjectShare(
                    { id: project.id },
                    {
                      onSuccess: (data) => {
                        toast.success(
                          data.isPublic
                            ? "Public sharing enabled"
                            : "Public sharing disabled",
                        );
                      },
                      onError: () => {
                        toast.error("Failed to toggle public sharing");
                      },
                    },
                  );
                }}
              />
            </div>

            {project?.isPublic && project.shareToken && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Public link
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/share/${project.shareToken}`}
                    className="bg-muted/50 text-xs"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      const url = `${window.location.origin}/share/${project.shareToken}`;
                      try {
                        await copyTextToClipboard(url);
                        setShareUrlCopied(true);
                        setTimeout(() => setShareUrlCopied(false), 2000);
                      } catch {
                        toast.error("Could not copy link");
                      }
                    }}
                  >
                    {shareUrlCopied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={metadataDialogOpen} onOpenChange={setMetadataDialogOpen}>
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Update how this project appears in your dashboard and sidebar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="project-title">Title</Label>
              <Input
                id="project-title"
                value={metadataTitle}
                onChange={(event) => setMetadataTitle(event.target.value)}
                className="bg-muted/50"
                maxLength={120}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={metadataDescription}
                onChange={(event) => setMetadataDescription(event.target.value)}
                className="min-h-28 bg-muted/50"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMetadataDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveProjectMetadata()}
              disabled={isSavingMetadata}
            >
              <Check className="size-4" />
              {isSavingMetadata ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer
        direction="right"
        open={codeEditorOpen}
        // onOpenChange={handleCloseCodeEditor}
      >
        <DrawerContent className="min-w-3xl border-border bg-background text-foreground">
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="flex items-center gap-2 text-foreground">
              <Code2 className="size-4" />
              Edit generated TSX
            </DrawerTitle>
            <DrawerDescription>
              Changes are saved as an override, so the original generation
              remains recoverable.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <Textarea
              value={codeEditorValue}
              onChange={(event) => setCodeEditorValue(event.target.value)}
              spellCheck={false}
              className={cn(
                "min-h-[calc(100vh-190px)] flex-1 resize-none border-border bg-muted font-mono text-xs leading-5 text-foreground scrollbar",
                mono.className,
              )}
            />
          </div>
          <DrawerFooter className="border-t border-border">
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleCloseCodeEditor(false)}
                className="cursor-pointer"
              >
                <X className="size-4" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveCodeEditor}
                className="cursor-pointer"
              >
                <Check className="size-4" />
                Save code
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <FrameHistoryPanel
        projectId={projectId}
        frameId={historyPanelFrameId}
        open={!!historyPanelFrameId}
        onOpenChange={(open) => {
          if (!open) setHistoryPanelFrameId(null);
        }}
        isRestoring={isRestoring}
        onRestore={(versionNumber) => {
          if (!historyPanelFrameId) return;
          restoreFrameVersion(
            {
              projectId,
              frameId: historyPanelFrameId,
              versionNumber,
            },
            {
              onSuccess: (data) => {
                const restoredScreen = data.generation.screens.find(
                  (s) => s.id === historyPanelFrameId,
                );
                if (!restoredScreen) return;

                applyFrames((current) => {
                  const next = new Map(current);
                  const frame = next.get(historyPanelFrameId!);
                  if (!frame) return next;
                  next.set(historyPanelFrameId!, {
                    ...frame,
                    generationId: data.generation.generationId,
                    content: restoredScreen.content,
                    editedContent: restoredScreen.editedContent,
                    state: restoredScreen.state,
                    error: restoredScreen.error,
                  });
                  return next;
                });

                scheduleSnapshotPersist(data.generation.generationId);
                toast.success(`Frame restored to version ${versionNumber}`);
                setHistoryPanelFrameId(null);
              },
            },
          );
        }}
      />

      <StudioPromptBar
        prompt={prompt}
        onPromptChange={setPrompt}
        onGenerate={() => void handleGenerate()}
        isGenerating={isPreparingFirstGeneration}
        canGenerate={canGenerate}
        activeFrameId={activeFrameId}
        generationMode={generationMode}
        onToggleGenerationMode={() =>
          setGenerationMode((prev) =>
            prev === "generate" ? "regenerate" : "generate",
          )
        }
        generationErrorMessage={generationErrorMessage}
        generationRecoveryPrompt={generationRecoveryPrompt}
        onResumeGeneration={() => {
          setPrompt(generationRecoveryPrompt ?? "");
          setGenerationRecoveryPrompt(null);
          setGenerationErrorMessage(null);
          window.setTimeout(() => void handleGenerate(), 0);
        }}
        commandInputRef={commandInputRef}
        monoClassName={mono.className}
        onEscape={() => {
          setPrompt("");
          deselect();
        }}
        onLockedAction={handleLockedAction}
        canRegenerate={canRegenerate}
        activeStreamingScreen={activeStreamingScreen}
      />
    </StudioShell>
  );
};

export default ProjectStudioClient;
