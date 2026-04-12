/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { JetBrains_Mono } from "next/font/google";
import {
  createShapeId,
  TLComponents,
  type Editor,
  Tldraw,
  useEditor,
  useValue,
  TLShapeId,
  TLUiToolsContextType,
  DefaultToolbar,
  TldrawUiMenuGroup,
  HandToolbarItem,
  SelectToolbarItem,
  TldrawUiMenuItem,
} from "tldraw";
import "tldraw/tldraw.css";

import { PhoneFrameShapeUtil } from "@/components/shapes/PhoneFrameShapeUtil";
import logger from "@/lib/logger";
import {
  getGenerationLayout,
  getInitialDimensionsForPlatform,
} from "@/lib/canvasLayout";
import { GenerationPlatform } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Monitor,
  Smartphone,
  Sparkles,
  SquareDashed,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import SelectModel from "@/components/SelectModel";
import { cn } from "@/lib/utils";
import ProjectMenuPanel from "@/components/projects/TopMenu";
import { useParams } from "next/navigation";
import {
  useProjectQuery,
  useProjectStatusUpdateMutation,
} from "@/lib/projects/queries";
import { useUserActivityStore } from "@/providers/zustand-provider";

const DASHBOARD_MODEL_ALIASES: string[] = [
  "gemma4:31b",
  "gpt-oss:120b",
  "deepseek-v3.1:671b",
  "qwen3.5",
  "deepseek-v3.2:cloud",
];

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const components: TLComponents = {
  Background: () => (
    <div
      className="tl-background"
      style={{
        background:
          "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.05), transparent 22%), radial-gradient(circle at 82% 84%, rgba(255,255,255,0.04), transparent 26%), var(--background)",
      }}
    />
  ),
  Grid: ({ size, ...camera }) => {
    const editor = useEditor();
    const screenBounds = useValue(
      "screenBounds",
      () => editor.getViewportScreenBounds(),
      [],
    );
    const devicePixelRatio = useValue(
      "dpr",
      () => editor.getInstanceState().devicePixelRatio,
      [],
    );
    const canvas = useRef<HTMLCanvasElement>(null);
    editor.user.updateUserPreferences({
      colorScheme: "dark",
      color: "#202124",
    });

    useLayoutEffect(() => {
      if (!canvas.current) return;

      const canvasW = screenBounds.w * devicePixelRatio;
      const canvasH = screenBounds.h * devicePixelRatio;

      canvas.current.width = canvasW;
      canvas.current.height = canvasH;

      const ctx = canvas.current.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvasW, canvasH);

      const pageViewportBounds = editor.getViewportPageBounds();
      const startPageX = Math.ceil(pageViewportBounds.minX / size) * size;
      const startPageY = Math.ceil(pageViewportBounds.minY / size) * size;
      const endPageX = Math.floor(pageViewportBounds.maxX / size) * size;
      const endPageY = Math.floor(pageViewportBounds.maxY / size) * size;
      const numRows = Math.round((endPageY - startPageY) / size);
      const numCols = Math.round((endPageX - startPageX) / size);

      const majorDot = "#2f2f2f";
      const majorStep = 2;
      const majorRadius = 2 * devicePixelRatio;

      for (let row = 0; row <= numRows; row += majorStep) {
        const pageY = startPageY + row * size;
        const canvasY = (pageY + camera.y) * camera.z * devicePixelRatio;

        for (let col = 0; col <= numCols; col += majorStep) {
          const pageX = startPageX + col * size;
          const canvasX = (pageX + camera.x) * camera.z * devicePixelRatio;

          ctx.beginPath();
          ctx.fillStyle = majorDot;
          ctx.arc(canvasX, canvasY, majorRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }, [camera, devicePixelRatio, editor, screenBounds, size]);

    return <canvas className="tl-grid" ref={canvas} />;
  },
  Toolbar: () => {
    const editor = useEditor();

    return (
      <DefaultToolbar orientation={"vertical"}>
        <TldrawUiMenuGroup id="controls">
          <SelectToolbarItem />
          <HandToolbarItem />
          <TldrawUiMenuItem
            id="fit-to-screen"
            onSelect={() => {
              editor.zoomToFit({ animation: { duration: 200 } });
            }}
            label="Fit to screen"
            icon={<SquareDashed className="size-4" />}
          />
          <TldrawUiMenuItem
            id="zoom-in"
            onSelect={() => {
              editor.zoomIn(editor.getViewportScreenCenter(), {
                animation: { duration: 120 },
              });
            }}
            label="Zoom in"
            icon={<ZoomIn className="size-4" />}
          />
          <TldrawUiMenuItem
            id="zoom-out"
            onSelect={() => {
              editor.zoomOut(editor.getViewportScreenCenter(), {
                animation: { duration: 200 },
              });
            }}
            label="Zoom out"
            icon={<ZoomOut className="size-4" />}
          />
        </TldrawUiMenuGroup>
      </DefaultToolbar>
    );
  },
  ContextMenu: null,
  HelpMenu: null,
  StylePanel: null, // required
  MenuPanel: null, // required
};

const shapeUtils = [PhoneFrameShapeUtil]; // defined OUTSIDE component — never recreate in render

const StudioPage = () => {
  const { id: projectId } = useParams<{ id: string }>();

  const {
    data: project,
    isLoading: projectLoading,
    isError,
    error,
  } = useProjectQuery(projectId);

  const {} = useProjectStatusUpdateMutation();

  const model = useUserActivityStore((state) => state.model);
  const setModel = useUserActivityStore((state) => state.setModel);
  const spec = useUserActivityStore((state) => state.spec);
  const setSpec = useUserActivityStore((state) => state.setSpec);

  const editorRef = useRef<Editor | null>(null);
  const shapeIdRef = useRef<ReturnType<typeof createShapeId> | null>(null);
  const screenBuffersRef = useRef<Map<string, string>>(new Map());
  const frameIdsRef = useRef<Map<string, TLShapeId>>(new Map());

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStreamingScreen, setActiveStreamingScreen] = useState<
    string | null
  >(null);

  const canGenerate = !!prompt.trim() && !isGenerating;
  const models = [...DASHBOARD_MODEL_ALIASES];

  const handleGenerate = async () => {
    if (!project) {
      logger.error("Project not found");
      return;
    }

    setIsGenerating(true);
    setActiveStreamingScreen(null);
    try {
      if (!editorRef.current) throw new Error("Editor not initialized");

      // 2. On each token — accumulate and update the shape
      shapeIdRef.current = null;
      screenBuffersRef.current = new Map();
      logger.info("Sending generation request with prompt:", prompt);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          prompt: project.status === "PENDING" ? project.initialPrompt : prompt,
          platform: spec ?? "web",
        }),
      });

      setPrompt("");

      logger.info("Generation request sent. Awaiting response...");

      if (!response.ok || !response.body) {
        const errorData = await response.json();

        logger.error("Error response: ", errorData);
        throw new Error(errorData.message || "Generation failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") return;

          const event = JSON.parse(raw);
          handleEvent(event); // <-- pass accumulated as an argument to handleEvent
        }
      }
    } catch (error) {
      logger.error("Error generating layout:", error);
    } finally {
      setActiveStreamingScreen(null);
      setIsGenerating(false);
    }
  };

  function handleEvent(event: any) {
    const editor = editorRef.current;
    if (!editor) return;

    if (event.type === "spec") {
      const spec = event.spec;
      const platform: GenerationPlatform =
        spec.platform === "mobile" ? "mobile" : "web";
      const screensWithDims: Array<{ name: string; w: number; h: number }> =
        spec.screens.map((screenName: string) => ({
          name: screenName,
          ...getInitialDimensionsForPlatform(screenName, platform),
        }));
      const positions = getGenerationLayout(editor, screensWithDims);
      frameIdsRef.current = new Map();
      screenBuffersRef.current = new Map();

      screensWithDims.forEach((screen, i: number) => {
        const id = createShapeId();
        frameIdsRef.current.set(screen.name, id);

        editor.createShape({
          id,
          type: "phone-frame",
          x: positions[i].x,
          y: positions[i].y,
          props: {
            w: screen.w,
            h: screen.h,
            screenName: screen.name,
            platform,
            content: "",
            state: "skeleton",
            srcdoc: "",
          },
        });
      });

      editor.zoomToFit({ animation: { duration: 400 } });
    } else if (event.type === "screen_start") {
      const id = frameIdsRef.current.get(event.screen);
      screenBuffersRef.current.set(event.screen, "");
      setActiveStreamingScreen(event.screen);
      if (id)
        editor.updateShape({
          id,
          type: "phone-frame",
          props: { state: "streaming" },
        });
    } else if (event.type === "screen_reset") {
      const id = frameIdsRef.current.get(event.screen);
      if (!id) return;
      screenBuffersRef.current.set(event.screen, "");
      setActiveStreamingScreen(event.screen);
      editor.updateShape({
        id,
        type: "phone-frame",
        props: {
          content: "",
          state: "streaming",
        },
      });
    } else if (event.type === "code_chunk") {
      const id = frameIdsRef.current.get(event.screen);
      if (!id) return;
      const previous = screenBuffersRef.current.get(event.screen) ?? "";
      const next = previous + event.token;
      screenBuffersRef.current.set(event.screen, next);
      editor.updateShape({
        id,
        type: "phone-frame",
        props: {
          content: next,
          state: "streaming",
        },
      });
    }

    if (event.type === "screen_done") {
      const id = frameIdsRef.current.get(event.screen);
      if (!id) return;

      // Pass the full code and flip to done
      // The shape's useEffect watches these props and mounts Sandpack
      editor.updateShape({
        id,
        type: "phone-frame",
        props: {
          state: "done",
          content: screenBuffersRef.current.get(event.screen),
        },
      });

      screenBuffersRef.current.delete(event.screen);
      setActiveStreamingScreen((current) =>
        current === event.screen ? null : current,
      );
    }

    if (event.type === "done") {
      setActiveStreamingScreen(null);
      const newIds = [...frameIdsRef.current.values()];
      if (newIds.length > 0) {
        editor.select(...newIds);
        editor.zoomToSelection({ animation: { duration: 600 } });
        editor.selectNone();
      }
    }
  }

  const handleMount = (mountedEditor: Editor) => {
    editorRef.current = mountedEditor; // always current, never stale
    mountedEditor.updateInstanceState({ isGridMode: true });
  };

  useEffect(() => {
    if (projectLoading || isError) return;
    logger.info("Project info:", project);
    logger.info("Project error:", error);
    if (!project) {
      logger.error("Project not found");
      return;
    }
    if (project.status === "PENDING") {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, projectLoading, isError]);

  return (
    <div
      className={cn(
        "dark relative h-screen w-full overflow-hidden bg-background text-foreground",
        "selection:bg-primary selection:text-primary-foreground",
        "[--radius:2px] [--background:#111111] [--foreground:#e2e2e2]",
        "[--card:#1a1a1a] [--card-foreground:#e2e2e2] [--popover:#1a1a1a] [--popover-foreground:#f9f9f9]",
        "[--primary:#ffffff] [--primary-foreground:#000000] [--secondary:#1a1a1a] [--secondary-foreground:#f1f1f1]",
        "[--muted:#1a1a1a] [--muted-foreground:#777777] [--accent:#222222] [--accent-foreground:#f9f9f9]",
        "[--destructive:#ba1a1a] [--border:#222222] [--input:#333333] [--ring:#777777]",
      )}
    >
      {/* Tldraw Infinite Canvas */}
      <div className="absolute inset-0 z-40">
        <Tldraw
          shapeUtils={shapeUtils}
          components={components}
          onMount={handleMount}
          overrides={{
            tools: (_editor, tools: TLUiToolsContextType) => {
              // Remove the text tool
              delete tools.text;
              delete tools.stickyNote;
              return tools;
            },
          }}
        />
      </div>

      <ProjectMenuPanel />

      {/* Prompt Input */}
      <div className="pointer-events-none absolute inset-0 z-50">
        <div className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(980px,calc(100%-1.5rem))] -translate-x-1/2 rounded-md border border-input bg-card/90 p-2.5 shadow-2xl shadow-black/30 backdrop-blur-[1px]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 border border-input bg-muted p-1">
              <Button
                type="button"
                size="xs"
                variant={spec === "web" ? "secondary" : "ghost"}
                onClick={() => setSpec("web")}
                className={cn(
                  "h-7 px-2",
                  spec === "mobile" && "text-muted-foreground",
                )}
              >
                <Monitor data-icon="inline-start" className="size-4" />
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[0.18em]",
                    mono.className,
                  )}
                >
                  Web
                </span>
              </Button>
              <Button
                type="button"
                size="xs"
                variant={spec === "mobile" ? "secondary" : "ghost"}
                onClick={() => setSpec("mobile")}
                className={cn(
                  "h-7 px-2",
                  spec === "web" && "text-muted-foreground",
                )}
              >
                <Smartphone data-icon="inline-start" className="size-4" />
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[0.18em]",
                    mono.className,
                  )}
                >
                  Mobile
                </span>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {isGenerating && (
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-[10px] text-muted-foreground",
                    mono.className,
                  )}
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  {activeStreamingScreen
                    ? `Generating: ${activeStreamingScreen}`
                    : "Preparing generation..."}
                </span>
              )}
              <span
                className={cn(
                  "text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
                  mono.className,
                )}
              >
                Use Enter to generate and Shift+Enter for a new line
              </span>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <SelectModel list={models} setModel={setModel} model={model} />

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (canGenerate) handleGenerate();
                }
              }}
              placeholder="What would you like to change or create?"
              className={cn(
                "scrolling h-15 min-h-11 flex-1 resize-none rounded-md border border-input bg-background px-4 py-2.5 text-sm text-foreground outline-none transition",
                "placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30",
                isGenerating && "cursor-not-allowed opacity-80",
                mono.className,
              )}
            />

            <Button
              onClick={() => handleGenerate()}
              disabled={!canGenerate}
              className="h-11 rounded-md px-4"
            >
              <Sparkles
                className={`size-4 ${isGenerating ? "animate-spin" : ""}`}
              />
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StudioPageWrapper = () => {
  return (
    <Suspense>
      <StudioPage />
    </Suspense>
  );
};

export default StudioPageWrapper;
