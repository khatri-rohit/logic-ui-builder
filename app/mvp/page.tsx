/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useLayoutEffect, useRef, useState } from 'react';
import { createShapeId, TLComponents, type Editor, Tldraw, useEditor, useValue, TLShapeId } from 'tldraw'
import 'tldraw/tldraw.css'

import RightPanel from '@/components/RightPanel';
import { PhoneFrameShapeUtil } from '@/components/shapes/PhoneFrameShapeUtil';
import logger from '@/lib/logger';
import { getGenerationLayout } from '@/lib/canvasLayout';
import { useCompilerWorker } from '@/hooks/useCompilerWorker';

const components: TLComponents = {
    Grid: ({ size, ...camera }) => {
        const editor = useEditor()
        const screenBounds = useValue('screenBounds', () => editor.getViewportScreenBounds(), [])
        const devicePixelRatio = useValue('dpr', () => editor.getInstanceState().devicePixelRatio, [])
        const canvas = useRef<HTMLCanvasElement>(null)
        editor.user.updateUserPreferences({ colorScheme: 'system', color: '#202124' })

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

            const majorDot = '#7f7f7f'
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

const shapeUtils = [PhoneFrameShapeUtil]  // defined OUTSIDE component — never recreate in render


const StudioPage = () => {
    const editorRef = useRef<Editor | null>(null)
    const shapeIdRef = useRef<ReturnType<typeof createShapeId> | null>(null)
    const accumulatedTextRef = useRef('')
    const frameIdsRef = useRef<Map<string, TLShapeId>>(new Map())

    const [prompt, setPrompt] = useState('Design a clean dashboard for analytics with cards and charts')
    // const [prompt, setPrompt] = useState('Why is the sky blue?')
    const [isGenerating, setIsGenerating] = useState(false)
    const [conversation, setConversation] = useState<Array<{ role: string; content: string }>>([])

    const handleGenerate = async () => {
        if (!prompt.trim()) return

        setIsGenerating(true)
        try {
            if (!editorRef.current) throw new Error("Editor not initialized")

            // 2. On each token — accumulate and update the shape
            shapeIdRef.current = null
            accumulatedTextRef.current = ''


            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt }),
            })

            if (!response.ok || !response.body) {
                const errorData = await response.json()

                logger.error("Error response: ", errorData)
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
                    handleEvent(event) // <-- pass accumulated as an argument to handleEvent
                }
            }

        } catch (error) {
            logger.error('Error generating layout:', error)
        } finally {
            setIsGenerating(false)
        }
    }

    const { compile } = useCompilerWorker(({ screenName, html, error }) => {
        const editor = editorRef.current
        const id = frameIdsRef.current.get(screenName)
        if (!editor || !id) return

        editor.updateShape({
            id,
            type: 'phone-frame',
            props: {
                state: error ? 'error' : 'done',
                srcdoc: html ?? '',
            }
        })
    })

    // 2. handleEvent — screen_done triggers compile
    function handleEvent(event: any) {
        const editor = editorRef.current
        if (!editor) return

        if (event.type === 'spec') {
            const spec = event.spec
            const positions = getGenerationLayout(editor, spec.screens.length)
            frameIdsRef.current = new Map()

            spec.screens.forEach((screenName: string, i: number) => {
                const id = createShapeId()
                frameIdsRef.current.set(screenName, id)
                editor.createShape({
                    id, type: 'phone-frame',
                    x: positions[i].x,
                    y: positions[i].y,
                    props: { w: 1200, h: 720, screenName, content: '', state: 'skeleton', srcdoc: '' }
                })
            })
            editor.zoomToFit({ animation: { duration: 400 } })
        }

        if (event.type === 'screen_start') {
            const id = frameIdsRef.current.get(event.screen)
            if (id) editor.updateShape({ id, type: 'phone-frame', props: { state: 'streaming' } })
        }

        if (event.type === 'screen_reset') {
            const id = frameIdsRef.current.get(event.screen)
            if (!id) return
            accumulatedTextRef.current = ''
            editor.updateShape({
                id,
                type: 'phone-frame',
                props: {
                    content: '',
                    state: 'streaming'
                }
            })
        }

        if (event.type === 'code_chunk') {
            const id = frameIdsRef.current.get(event.screen)
            if (!id) return
            accumulatedTextRef.current += event.token
            editor.updateShape({
                id, type: 'phone-frame',
                props: {
                    content: accumulatedTextRef.current,
                    state: 'streaming'
                }
            })
        }

        if (event.type === 'screen_done') {
            const id = frameIdsRef.current.get(event.screen)
            if (!id) return

            // Mark as compiling while worker runs
            editor.updateShape({
                id,
                type: 'phone-frame',
                props: {
                    state: 'compiling'
                }
            })

            // Send code to worker — result comes back via onResult callback above
            compile(event.screen, accumulatedTextRef.current)
            console.log(accumulatedTextRef.current)

            // Reset accumulator for next screen
            accumulatedTextRef.current = ''
        }

        if (event.type === 'done') {
            const newIds = [...frameIdsRef.current.values()]
            if (newIds.length > 0) {
                editor.select(...newIds)
                editor.zoomToSelection({ animation: { duration: 600 } })
                editor.selectNone()
            }
        }
    }


    const handleMount = (mountedEditor: Editor) => {
        editorRef.current = mountedEditor   // always current, never stale
        mountedEditor.updateInstanceState({ isGridMode: true })
    }

    return (
        <div className="relative flex h-screen w-full flex-col-reverse overflow-hidden md:flex-row">

            <div className="relative h-full min-h-[45vh] flex-1 md:min-h-0">

                <div className="h-full">
                    <Tldraw hideUi shapeUtils={shapeUtils} components={components} onMount={handleMount} />
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
