/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useLayoutEffect, useRef, useState } from "react";
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
  Bot,
  Monitor,
  Smartphone,
  Sparkles,
  SquareDashed,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import SelectModel from "@/components/SelectModel";

const components: TLComponents = {
  Background: () => (
    <div
      className="tl-background"
      style={{
        background:
          "radial-gradient(circle at 18% 12%, rgba(255,140,43,0.08), transparent 22%), radial-gradient(circle at 82% 84%, rgba(66, 157, 255, 0.08), transparent 26%), #10141d",
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

      const majorDot = "#2d3442";
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
  const editorRef = useRef<Editor | null>(null);
  const shapeIdRef = useRef<ReturnType<typeof createShapeId> | null>(null);
  const screenBuffersRef = useRef<Map<string, string>>(new Map());
  const frameIdsRef = useRef<Map<string, TLShapeId>>(new Map());

  const [prompt, setPrompt] = useState(
    "Design a clean dashboard for analytics with cards and charts",
  );
  // const [prompt, setPrompt] = useState('Why is the sky blue?')
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStreamingScreen, setActiveStreamingScreen] = useState<
    string | null
  >(null);
  const [selectedPlatform, setSelectedPlatform] =
    useState<GenerationPlatform>("web");
  const [model, setModel] = useState<string>("llama3.2-vision:11b");

  const quickPrompts = [
    "UGC agency landing page with hero, social proof, pricing, and conversion-focused contact section",
    "Creative portfolio + service highlights with strong CTA hierarchy",
    "Case-study first website with testimonial and trust metrics blocks",
    "Modern brand site with cinematic hero and performance stats strip",
  ];
  const models = [
    "llama3.1:8b",
    "mistral:7b",
    "gpt-oss:120b-cloud",
    "llama3.2-vision:11b",
    "deepseek-v3.1:671b-cloud",
  ];
  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setActiveStreamingScreen(null);
    try {
      if (!editorRef.current) throw new Error("Editor not initialized");

      // 2. On each token — accumulate and update the shape
      shapeIdRef.current = null;
      screenBuffersRef.current = new Map();

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, prompt, platform: selectedPlatform }),
      });

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

  // 2. handleEvent — screen_done triggers compile
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

  const canGenerate = !!prompt.trim() && !isGenerating;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0d1017] text-zinc-100">
      {/* Tldraw Infinite Canvas */}
      <div className="absolute inset-0">
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

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-4 top-4 flex items-center gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-950/90 px-3 py-2 backdrop-blur-md">
          <Bot className="size-4 text-amber-300" />
          <p className="text-xs font-semibold tracking-wide text-zinc-200">
            Canvas Generation Studio
          </p>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
            3.0 Flash
          </span>
        </div>

        <div className="pointer-events-auto absolute left-4 top-16 flex max-w-[70vw] flex-wrap gap-2">
          {quickPrompts.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPrompt(item)}
              className="rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-amber-300/60 hover:text-zinc-100"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(980px,calc(100%-1.5rem))] -translate-x-1/2 rounded-3xl border border-zinc-700/80 bg-zinc-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1">
              <Button
                type="button"
                size="sm"
                variant={selectedPlatform === "web" ? "outline" : "ghost"}
                onClick={() => setSelectedPlatform("web")}
                className={`h-8 rounded-lg ${selectedPlatform === "web" ? "text-black" : ""}`}
              >
                <Monitor className="size-4" />
                Web
              </Button>
              <Button
                type="button"
                size="sm"
                variant={selectedPlatform === "mobile" ? "outline" : "ghost"}
                onClick={() => setSelectedPlatform("mobile")}
                className={`h-8 rounded-lg ${selectedPlatform === "mobile" ? "text-black" : ""}`}
              >
                <Smartphone className="size-4" />
                Mobile
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {isGenerating && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
                  {activeStreamingScreen
                    ? `Generating: ${activeStreamingScreen}`
                    : "Preparing generation..."}
                </span>
              )}
              <span className="text-[11px] text-zinc-500">
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
              className="scrolling h-11 min-h-11 flex-1 resize-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
            />

            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="h-11 rounded-2xl bg-zinc-100 px-4 text-zinc-950 hover:bg-white disabled:bg-zinc-700 disabled:text-zinc-300"
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

export default StudioPage;
