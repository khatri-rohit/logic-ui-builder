"use client";

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import RightPanel from '@/components/RightPanel';
import { TLComponents, type Editor, Tldraw, useEditor, useValue } from 'tldraw'
import 'tldraw/tldraw.css'

const components: TLComponents = {
    Grid: ({ size, ...camera }) => {
        const editor = useEditor()
        const screenBounds = useValue('screenBounds', () => editor.getViewportScreenBounds(), [])
        const devicePixelRatio = useValue('dpr', () => editor.getInstanceState().devicePixelRatio, [])
        const canvas = useRef<HTMLCanvasElement>(null)
        editor.user.updateUserPreferences({ colorScheme: 'system' })
        useLayoutEffect(() => {
            if (!canvas.current) return

            const canvasW = screenBounds.w * devicePixelRatio
            const canvasH = screenBounds.h * devicePixelRatio

            canvas.current.width = canvasW
            canvas.current.height = canvasH

            const ctx = canvas.current.getContext('2d')
            if (!ctx) return

            ctx.clearRect(0, 0, canvasW, canvasH)

            const pageViewportBounds = editor.getViewportPageBounds()
            const startPageX = Math.ceil(pageViewportBounds.minX / size) * size
            const startPageY = Math.ceil(pageViewportBounds.minY / size) * size
            const endPageX = Math.floor(pageViewportBounds.maxX / size) * size
            const endPageY = Math.floor(pageViewportBounds.maxY / size) * size
            const numRows = Math.round((endPageY - startPageY) / size)
            const numCols = Math.round((endPageX - startPageX) / size)

            const majorDot = '#5f5f5f'
            const majorStep = 2
            const majorRadius = 2 * devicePixelRatio

            for (let row = 0; row <= numRows; row += majorStep) {
                const pageY = startPageY + row * size
                const canvasY = (pageY + camera.y) * camera.z * devicePixelRatio

                for (let col = 0; col <= numCols; col += majorStep) {
                    const pageX = startPageX + col * size
                    const canvasX = (pageX + camera.x) * camera.z * devicePixelRatio

                    ctx.beginPath()
                    ctx.fillStyle = majorDot
                    ctx.arc(canvasX, canvasY, majorRadius, 0, Math.PI * 2)
                    ctx.fill()
                }
            }
        }, [camera, devicePixelRatio, editor, screenBounds, size])

        return <canvas className="tl-grid" ref={canvas} />
    },
}

const StudioPage = () => {
    const [editor, setEditor] = useState<Editor | null>(null)
    // const [prompt, setPrompt] = useState('Design a clean dashboard for analytics with cards and charts')
    const [prompt, setPrompt] = useState('Why is the sky blue?')
    const [isGenerating, setIsGenerating] = useState(false)
    const [conversation, setConversation] = useState<Array<{ role: string; content: string }>>([])

    const handleGenerate = async () => {
        if (!prompt.trim()) return

        setIsGenerating(true)
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt }),
            })

            if (!response.ok || !response.body) {
                const errorData = await response.json()
                console.log("Error resposen: ", errorData)
                throw new Error(errorData.message || 'Generation failed')
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = '';

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                sseBuffer += decoder.decode(value, { stream: true })
                const lines = sseBuffer.split('\n')
                sseBuffer = lines.pop() ?? ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const raw = line.slice(6).trim()
                    if (raw === '[DONE]') return

                    const event = JSON.parse(raw)
                    // console.log(event); // at minimum — until tldraw integration is wired
                    handleEvent(event)
                }
            }

        } catch (error) {
            console.error('Error generating layout:', error)
        } finally {
            setIsGenerating(false)
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function handleEvent(event: any) {
        if (event.type === "chat") {
            setConversation((prev) => {
                const oldMessage = [...prev]
                const lastMessage = oldMessage[0]
                if (lastMessage) {
                    lastMessage.content += event.text
                }

                return [lastMessage, ...oldMessage]
            })
            if (event.type === "error") {
                console.error("Stream error:", event.message);
            }
        }
    }


    const handleMount = (mountedEditor: Editor) => {
        setEditor(mountedEditor)
        mountedEditor.updateInstanceState({ isGridMode: true })
    }

    return (
        <div className="relative flex h-screen w-full flex-col-reverse overflow-hidden md:flex-row">

            <div className="relative h-full min-h-[45vh] flex-1 md:min-h-0">

                <div className="h-full">
                    <Tldraw hideUi components={components} onMount={handleMount} />
                </div>
            </div>
            <RightPanel
                prompt={prompt}
                isGenerating={isGenerating}
                onPromptChange={setPrompt}
                onGenerate={handleGenerate}
                conversation={conversation}
                setConversation={setConversation}
            />
        </div>
    )
}

export default StudioPage
