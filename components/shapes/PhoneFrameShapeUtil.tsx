/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import {
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  ShapeUtil,
  T,
  TLShape,
  TLResizeInfo,
  resizeBox,
  useEditor,
} from "tldraw";
import { GenerationPlatform } from "@/lib/types";
import {
  loadSandpackClient,
  SandpackClient,
} from "@codesandbox/sandpack-client";
import { buildSandpackFiles } from "@/lib/sandpackTemplate";

const SHAPE_TYPE = "phone-frame";

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [SHAPE_TYPE]: {
      w: number;
      h: number;
      screenName: string;
      platform: GenerationPlatform;
      content: string;
      state: string;
      srcdoc: string;
    };
  }
}

type PhoneFrameShape = TLShape<typeof SHAPE_TYPE> & any; // to allow extra props for now and remove error, can be removed later when we have a better shape schema solution

export class PhoneFrameShapeUtil extends ShapeUtil<PhoneFrameShape> {
  static override type = SHAPE_TYPE;
  static override props: RecordProps<PhoneFrameShape> = {
    w: T.number,
    h: T.number,
    screenName: T.string,
    platform: T.string,
    content: T.string,
    state: T.string,
    srcdoc: T.string,
  };

  getDefaultProps() {
    return {
      w: 200,
      h: 380,
      screenName: "",
      platform: "mobile",
      content: "",
      state: "skeleton",
      srcdoc: "",
    };
  }

  getGeometry(shape: PhoneFrameShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override onResize(shape: any, info: TLResizeInfo<any>) {
    return resizeBox(shape, info);
  }

  component(shape: PhoneFrameShape) {
    return <PhoneFrameShapeComponent shape={shape} />;
  }

  indicator(shape: PhoneFrameShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}

function PhoneFrameShapeComponent({ shape }: { shape: PhoneFrameShape }) {
  const { state, content, screenName, platform, w, h } = shape.props;
  const editor = useEditor();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const clientRef = useRef<SandpackClient | null>(null);

  // Passive dimension listener — shape-scoped, no Sandpack coupling
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== "frame-dimensions") return;

      // Identify which iframe sent this by checking source
      if (e.source !== iframeRef.current?.contentWindow) return;

      const reportedW = Number(e.data.width) || 0;
      const reportedH = Number(e.data.height) || 0;

      if (!reportedW || !reportedH) return;

      const newW =
        platform === "web"
          ? Math.min(Math.max(Math.ceil(reportedW), 1440), 4096)
          : w;
      const newH =
        platform === "web"
          ? Math.min(Math.max(Math.ceil(reportedH), 220), 20000)
          : Math.min(Math.max(Math.ceil(reportedH), 560), 2200);

      const wDiff = Math.abs(newW - w);
      const hDiff = Math.abs(newH - h);
      if (wDiff < 4 && hDiff < 4) return;

      editor.updateShape({
        id: shape.id,
        type: "phone-frame",
        props: {
          ...(platform === "web" && wDiff >= 4 && { w: newW }),
          ...(hDiff >= 4 && { h: newH }),
        },
      });
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [platform, w, h, shape.id, editor]);

  useEffect(() => {
    if (state !== "done" || !content || !iframeRef.current) return;
    console.log(content);
    (async () => {
      const nextSandbox = {
        files: buildSandpackFiles(content),
        entry: "/index.tsx",
        template: "create-react-app-typescript" as const,
      };

      if (clientRef.current) {
        clientRef.current.updateSandbox(nextSandbox);
        return;
      }

      const client = await loadSandpackClient(iframeRef.current!, nextSandbox, {
        showOpenInCodeSandbox: false,
        showErrorScreen: true,
        showLoadingScreen: true,
        externalResources: [
          "https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,line-clamp,container-queries",
        ],
      });

      clientRef.current = client;
    })();
  }, [state, content]);

  useEffect(
    () => () => {
      clientRef.current?.destroy();
    },
    [],
  );

  const statusBg =
    state === "done" ? "#dcfce7" : state === "error" ? "#fee2e2" : "#e2e8f0";
  const statusText =
    state === "done" ? "#166534" : state === "error" ? "#991b1b" : "#334155";

  return (
    <HTMLContainer
      style={{
        borderRadius: 10,
        border: "1px solid rgba(189, 199, 216, 0.58)",
        boxShadow: "0 18px 34px rgba(2, 8, 20, 0.22)",
        overflow: "hidden",
        position: "relative",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          overflow: "hidden",
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      >
        {state === "skeleton" && <SkeletonScreen />}
        {state === "streaming" && <StreamingScreen />}

        {(state === "streaming" || state === "skeleton") && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              zIndex: 2,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              border: "1px solid rgba(16,185,129,0.35)",
              background: "rgba(16,185,129,0.12)",
              color: "#065f46",
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#10b981",
                animation: "pulse 1.2s ease-in-out infinite",
              }}
            />
            {state === "streaming"
              ? `Generating ${screenName || "screen"}`
              : "Preparing screen"}
          </div>
        )}

        {state === "compiling" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#475569",
              fontSize: 11,
              background:
                "repeating-linear-gradient(-45deg, rgba(148,163,184,0.08) 0 8px, rgba(148,163,184,0.04) 8px 16px)",
            }}
          >
            Compiling preview...
          </div>
        )}

        {state === "done" && (
          <iframe
            ref={iframeRef}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: state === "done" ? "block" : "none",
            }}
            allow="cross-origin-isolated"
          />
        )}

        {state === "error" && (
          <div
            style={{
              padding: 12,
              color: "#b91c1c",
              fontSize: 10,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              overflow: "auto",
              height: "100%",
              background: "#fff5f5",
            }}
          >
            Compile failed
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            fontSize: 9,
            lineHeight: "14px",
            height: 14,
            paddingInline: 6,
            borderRadius: 999,
            background: statusBg,
            color: statusText,
            textTransform: "capitalize",
            fontWeight: 600,
            pointerEvents: "none",
          }}
        >
          {state}
        </div>
      </div>
    </HTMLContainer>
  );
}

function SkeletonScreen() {
  return (
    <div
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "#fff",
        width: "100%",
        height: "100%",
      }}
    >
      {[96, 82, 100, 74, 88].map((w, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 96 : 12,
            width: `${w}%`,
            background: "#e2e8f0",
            borderRadius: i === 0 ? 10 : 6,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

function StreamingScreen() {
  return (
    <div
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 7,
        background: "#fff",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          width: 48,
          height: 5,
          background: "#cbd5e1",
          borderRadius: 999,
          animation: "grow 1.2s ease-in-out infinite",
        }}
      />
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        Receiving code...
      </div>
    </div>
  );
}
