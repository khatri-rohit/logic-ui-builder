"use client";

import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'

const StudioPage = () => {
    return (
        <div style={{ position: 'fixed', inset: 0 }}>
            <Tldraw hideUi />
        </div>
    )
}

export default StudioPage
