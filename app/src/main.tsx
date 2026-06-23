import '@fontsource-variable/geist'
import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found')

const render = (): void => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// In dev, boot the MSW worker so the generation pipeline is mocked end-to-end —
// UNLESS VITE_USE_MOCKS=false, which lets `pnpm dev` talk to the real backend
// (via the Vite proxy in vite.config.ts) for full prompt→DeepSeek→engine runs.
if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS !== 'false') {
  void import('./mocks/browser').then(({ startMockWorker }) => startMockWorker().then(render))
} else {
  render()
}
