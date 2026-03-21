import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

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
    const quickPrompts = [
        'Board-ready KPI dashboard with quarterly trend blocks',
        'Compliance-first admin console with audit timeline',
        'Operations cockpit with alerts, tasks, and status cards',
    ]

    const canGenerate = !!prompt.trim() && !isGenerating

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
                            className='rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition duration-150 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white'
                        >
                            {item}
                        </button>
                    ))}
                </div>
                <div className='my-6 h-px w-full bg-zinc-700/50' />
                <div className='flex-1 overflow-y-auto flex flex-col-reverse gap-3'>
                    {conversation.length === 0 && (
                        <div className='py-4 text-center text-sm text-zinc-500'>
                            No conversation yet. Start by entering a prompt and generating a layout.
                        </div>
                    )}
                    {conversation.map((message, index) => (
                        <div key={index} id={`message-${index}`} className={`rounded-lg px-4 py-3 h-96 text-sm ${message.role === 'user' ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-700 text-zinc-200'} wrap-break-word overflow-y-auto scrolling`}>
                            {message.content}
                        </div>
                    ))}
                </div>
                <div className='mt-auto space-y-3 pt-5'>
                    <p className='font-(family-name:--font-geist-mono) text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400'>Prompt Blueprint</p>
                    <textarea
                        value={prompt}
                        onChange={(event) => onPromptChange(event.target.value)}
                        placeholder='Describe the UI system to generate for your product team...'
                        className='h-36 w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-zinc-100 outline-none transition duration-150 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30'
                    />

                    <Button
                        onClick={() => {
                            setConversation(prev => [{ role: 'user', content: prompt }, ...prev])
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