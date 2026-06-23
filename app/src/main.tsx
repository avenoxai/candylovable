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

// In dev, boot the MSW worker first so the generation pipeline is mocked end-to-end.
if (import.meta.env.DEV) {
  void import('./mocks/browser').then(({ startMockWorker }) => startMockWorker().then(render))
} else {
  render()
}
