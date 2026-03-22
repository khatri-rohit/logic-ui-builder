import { useEffect, useRef } from 'react'

type CompilerResult = {
  screenName: string
  html: string | null
  error: string | null
}

type OnResult = (result: CompilerResult) => void

export function useCompilerWorker(onResult: OnResult) {
  const workerRef = useRef<Worker | null>(null)
  const onResultRef = useRef(onResult)
  // onResultRef.current = onResult   // always latest, no stale closure

  useEffect(() => {
    // Web Workers need a URL — /public files are served at root
    const worker = new Worker('/compiler.worker.js')

    worker.onmessage = (e: MessageEvent<CompilerResult>) => {
      onResultRef.current(e.data)
    }

    worker.onerror = (err) => {
      console.error('[compiler worker]', err.message)
    }

    workerRef.current = worker

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])   // mount once, never recreate

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])  // update ref on every onResult change

  function compile(screenName: string, code: string) {
    workerRef.current?.postMessage({ screenName, code })
  }

  return { compile }
}