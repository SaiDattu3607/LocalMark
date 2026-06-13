import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { AIProvider } from './context/AIContext.tsx'
import { ToastProvider } from './components/Toast.tsx'

// StrictMode is disabled — it double-mounts components which breaks WebGPU / WebLLM
createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <ThemeProvider>
      <AIProvider>
        <App />
      </AIProvider>
    </ThemeProvider>
  </ToastProvider>,
)
