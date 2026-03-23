import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'

type RightPanelProps = {
    prompt: string
    isGenerating: boolean
    onPromptChange: (value: string) => void
    onGenerate: () => void
    conversation: Array<{ role: string; content: string }>
    setConversation: React.Dispatch<React.SetStateAction<Array<{ role: string; content: string }>>>
}

const RightPanel = ({
    prompt,
    isGenerating,
    onPromptChange,
    onGenerate,
    conversation,
    setConversation,
}: RightPanelProps) => {
    const conversationViewportRef = useRef<HTMLDivElement>(null)
    const conversationEndRef = useRef<HTMLDivElement>(null)

    const quickPrompts = [
        'Board-ready KPI dashboard with quarterly trend blocks',
        'Compliance-first admin console with audit timeline',
        'Operations cockpit with alerts, tasks, and status cards',
        "Create a UGC agency website a landing page for content creation brand should reflect the brand identity and what they do. The website should have a modern and creative design that showcases the agency's portfolio and services. It should include sections for case studies, client testimonials, and a contact form for potential clients to get in touch. The color scheme should be vibrant and eye-catching, with a focus on visual storytelling to highlight the agency's expertise in content creation."
    ]

    const canGenerate = !!prompt.trim() && !isGenerating

    useEffect(() => {
        if (!conversationViewportRef.current) return

        conversationEndRef.current?.scrollIntoView({
            behavior: 'auto',
            block: 'end',
        })
    }, [conversation])

    return (
        <aside className='relative w-full overflow-hidden border-t border-zinc-300/70 bg-zinc-950 p-5 text-zinc-100 md:h-screen md:w-[31.2rem] md:border-t-0 md:border-l md:border-l-zinc-800 md:p-6'>
            <div className='relative flex h-full flex-col'>

                <div className='mt-4'>
                    <p className='font-(family-name:--font-geist-mono) text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500'>Quick Presets</p>
                </div>
                <div className='mt-2 flex flex-wrap gap-2'>
                    {quickPrompts.map((item) => (
                        <button
                            key={item}
                            type='button'
                            onClick={() => onPromptChange(item)}
                            className='rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition duration-150 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white text-left'
                        >
                            {item}
                        </button>
                    ))}
                </div>
                <div className='my-6 h-px w-full bg-zinc-700/50' />
                <div ref={conversationViewportRef} 
                className='flex-1 space-y-3 overflow-y-auto rounded-2xl p-3 scrolling'>
                    {conversation.length === 0 && (
                        <div className='py-8 text-center text-sm text-zinc-500'>
                            No conversation yet. Start by entering a prompt and generating a layout.
                        </div>
                    )}
                    {conversation.map((message, index) => (
                        <div
                            key={index}
                            id={`message-${index}`}
                            className={`max-w-[90%] max-h-96 rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap overflow-auto scrolling ${message.role === 'user'
                                ? 'ml-auto bg-zinc-100 text-zinc-950'
                                : 'mr-auto bg-zinc-800 text-zinc-100'
                                }`}
                        >
                            {message.content || (message.role === 'assistant' ? '...' : '')}
                        </div>
                    ))}
                    <div ref={conversationEndRef} />
                </div>
                <div className='mt-auto space-y-3 pt-5'>
                    <p className='font-(family-name:--font-geist-mono) text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400'>Prompt Blueprint</p>
                    <textarea
                        value={prompt}
                        onChange={(event) => onPromptChange(event.target.value)}
                        placeholder='Describe the UI system to generate for your product team...'
                        className='scrolling h-36 w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-zinc-100 outline-none transition duration-150 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30'
                    />

                    <Button
                        onClick={() => {
                            setConversation(prev => [
                                ...prev,
                                { role: 'user', content: prompt },
                                { role: 'assistant', content: '' },
                            ])
                            onGenerate()
                        }}
                        disabled={!canGenerate}
                        className='h-11 rounded-xl border border-zinc-600 bg-zinc-100 text-zinc-950 hover:bg-white disabled:border-zinc-700 disabled:bg-zinc-700 disabled:text-zinc-300'
                    >
                        <Sparkles className={`size-4 ${isGenerating ? 'animate-spin' : ''}`} />
                        {isGenerating ? 'Generating Layout...' : 'Generate Interface'}
                    </Button>
                </div>

                <div className='pt-4 text-[11px] leading-relaxed text-zinc-500'>
                    Focused workspace for faster prompt-to-layout iteration.
                </div>
            </div>
        </aside>
    )
}

export default RightPanel