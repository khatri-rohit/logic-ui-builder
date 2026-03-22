/* eslint-disable @typescript-eslint/no-explicit-any */
// components/shapes/PhoneFrameShapeUtil.tsx
import { HTMLContainer, RecordProps, Rectangle2d, ShapeUtil, T, TLShape, TLResizeInfo, resizeBox } from 'tldraw'

const SHAPE_TYPE = 'phone-frame'

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    [SHAPE_TYPE]: {
      w: number
      h: number
      screenName: string
      content: string
      state: string
      srcdoc: string    // ← new
    }
  }
}

type PhoneFrameShape = TLShape<typeof SHAPE_TYPE>

export class PhoneFrameShapeUtil extends ShapeUtil<PhoneFrameShape> {
  static override type = SHAPE_TYPE
  static override props: RecordProps<PhoneFrameShape> = {
    w: T.number,
    h: T.number,
    screenName: T.string,
    content: T.string,
    state: T.string,
    srcdoc: T.string,   // ← new
  }

  getDefaultProps() {
    return { w: 200, h: 380, screenName: '', content: '', state: 'skeleton', srcdoc: '' }
  }

  getGeometry(shape: PhoneFrameShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: any, info: TLResizeInfo<any>) {
    return resizeBox(shape, info)
  }

  component(shape: PhoneFrameShape) {
    const { state, srcdoc, screenName } = shape.props

    return (
      <HTMLContainer style={{
        borderRadius: 36,
        border: '8px solid #1c1c1e',
        background: '#000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}>
        {/* Notch */}
        {/* <div style={{
          height: 30, background: '#000', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 60, height: 7, background: '#1c1c1e', borderRadius: 4 }} />
        </div> */}
        {/* Label */}
        <div style={{
          height: 22, background: '#000', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.05em' }}>
            {screenName}
          </span>
        </div>
        
        {/* Screen area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#111' }}>

          {state === 'skeleton' && <SkeletonScreen />}

          {state === 'streaming' && <StreamingScreen />}

          {state === 'compiling' && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: '#555', fontSize: 10
            }}>
              Compiling...
            </div>
          )}

          {state === 'done' && srcdoc && (
            <iframe
              srcDoc={srcdoc}
              sandbox="allow-scripts"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          )}

          {state === 'error' && (
            <div style={{
              padding: 12, color: '#ff6b6b', fontSize: 9,
              fontFamily: 'monospace', overflow: 'auto', height: '100%'
            }}>
              Compile failed
            </div>
          )}
        </div>


      </HTMLContainer>
    )
  }

  indicator(shape: PhoneFrameShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}

function SkeletonScreen() {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[100, 70, 90, 50, 80].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 80 : 12,
          width: `${w}%`,
          background: '#1e1e1e',
          borderRadius: 6,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  )
}

function StreamingScreen() {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        width: 40, height: 4, background: '#333', borderRadius: 2,
        animation: 'grow 1.2s ease-in-out infinite'
      }} />
      <div style={{ fontSize: 8, color: '#555', fontFamily: 'monospace' }}>
        Receiving code...
      </div>
    </div>
  )
}