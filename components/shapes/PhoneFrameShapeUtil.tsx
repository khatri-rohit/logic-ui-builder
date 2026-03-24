/* eslint-disable @typescript-eslint/no-explicit-any */
// components/shapes/PhoneFrameShapeUtil.tsx
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

type PhoneFrameShape = TLShape<typeof SHAPE_TYPE>;

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
  const { state, srcdoc, screenName, platform, w, h } = shape.props;
  const isMobile = platform === "mobile";
  const editor = useEditor();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (state !== "done" || isMobile) return;

    function handleMessage(e: MessageEvent) {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || e.source !== iframeWindow) return;
      if (e.data?.type !== "iframe-resize") return;

      const rawWidth = Number(e.data?.width);
      const rawHeight = Number(e.data?.height);
      if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight)) return;

      const newW = Math.min(Math.max(rawWidth, 620), 1920);
      const newH = Math.min(Math.max(rawHeight, 420), 7000);

      if (Math.abs(newW - w) < 4 && Math.abs(newH - h) < 4) return;

      editor.updateShape({
        id: shape.id,
        type: "phone-frame",
        props: { w: newW, h: newH },
      });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isMobile, state, w, h, editor, shape.id]);

  const frameStyle = isMobile
    ? {
        borderRadius: 16,
        border: "1px solid rgba(191, 200, 217, 0.65)",
        background: "#f8fafc",
        boxShadow: "0 14px 28px rgba(2, 8, 20, 0.22)",
      }
    : {
        borderRadius: 10,
        border: "1px solid rgba(189, 199, 216, 0.58)",
        background: "#f8fafc",
        boxShadow: "0 18px 34px rgba(2, 8, 20, 0.22)",
      };

  const statusBg =
    state === "done" ? "#dcfce7" : state === "error" ? "#fee2e2" : "#e2e8f0";
  const statusText =
    state === "done" ? "#166534" : state === "error" ? "#991b1b" : "#334155";

  return (
    <HTMLContainer
      style={{
        ...frameStyle,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        style={{
          height: 28,
          background: "#eef2f8",
          borderBottom: "1px solid rgba(186, 196, 213, 0.55)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingInline: 10,
          color: "#334155",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: "linear-gradient(135deg,#7cc0ff,#3b82f6)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.55)",
              flexShrink: 0,
            }}
          />
          <span
            title={screenName}
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: isMobile ? 130 : 280,
            }}
          >
            {screenName || "Untitled Screen"}
          </span>
        </div>

        <span
          style={{
            fontSize: 9,
            lineHeight: "16px",
            height: 16,
            paddingInline: 6,
            borderRadius: 999,
            background: statusBg,
            color: statusText,
            textTransform: "capitalize",
            fontWeight: 600,
          }}
        >
          {state}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          background: "#fff",
        }}
      >
        {state === "skeleton" && <SkeletonScreen />}
        {state === "streaming" && <StreamingScreen />}

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

        {state === "done" && srcdoc && (
          <iframe
            ref={iframeRef}
            srcDoc={srcdoc}
            sandbox="allow-scripts"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
              background: "#fff",
            }}
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
