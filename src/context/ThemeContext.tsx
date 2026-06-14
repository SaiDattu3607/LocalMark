import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getSetting, setSetting } from '../db'

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = '13px' | '15px' | '17px'
export type EditorFont = 'monospace' | 'sans-serif'

export interface AppSettings {
  theme: ThemeMode
  editorFontSize: FontSize
  editorFont: EditorFont
  previewFontSize: FontSize
  aiModel: string
  ollamaUrl: string
  customSystemPrompt: string
  sidebarCollapsed: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  editorFontSize: '15px',
  editorFont: 'monospace',
  previewFontSize: '15px',
  aiModel: 'llama3.2:1b',
  ollamaUrl: 'http://localhost:11434',
  customSystemPrompt: '',
  sidebarCollapsed: false,
}

interface ThemeContextValue {
  settings: AppSettings
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => Promise<void>
  resolvedTheme: 'light' | 'dark'
  loading: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveTheme(DEFAULT_SETTINGS.theme),
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [
          theme,
          editorFontSize,
          editorFont,
          previewFontSize,
          aiModel,
          ollamaUrl,
          customSystemPrompt,
          sidebarCollapsed,
        ] = await Promise.all([
          getSetting<AppSettings['theme']>('theme'),
          getSetting<AppSettings['editorFontSize']>('editorFontSize'),
          getSetting<AppSettings['editorFont']>('editorFont'),
          getSetting<AppSettings['previewFontSize']>('previewFontSize'),
          getSetting<AppSettings['aiModel']>('aiModel'),
          getSetting<AppSettings['ollamaUrl']>('ollamaUrl'),
          getSetting<AppSettings['customSystemPrompt']>('customSystemPrompt'),
          getSetting<AppSettings['sidebarCollapsed']>('sidebarCollapsed'),
        ])
        const loaded: AppSettings = {
          theme: theme ?? DEFAULT_SETTINGS.theme,
          editorFontSize: editorFontSize ?? DEFAULT_SETTINGS.editorFontSize,
          editorFont: editorFont ?? DEFAULT_SETTINGS.editorFont,
          previewFontSize: previewFontSize ?? DEFAULT_SETTINGS.previewFontSize,
          aiModel: aiModel ?? DEFAULT_SETTINGS.aiModel,
          ollamaUrl: ollamaUrl ?? DEFAULT_SETTINGS.ollamaUrl,
          customSystemPrompt: customSystemPrompt ?? DEFAULT_SETTINGS.customSystemPrompt,
          sidebarCollapsed: sidebarCollapsed ?? DEFAULT_SETTINGS.sidebarCollapsed,
        }
        setSettings(loaded)
        setResolvedTheme(resolveTheme(loaded.theme))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    setResolvedTheme(resolveTheme(settings.theme))
  }, [settings.theme])

  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setResolvedTheme(resolveTheme('system'))
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings.theme])

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(resolvedTheme)
  }, [resolvedTheme])

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
      await setSetting(key, value)
    },
    [],
  )

  const value = useMemo(
    () => ({ settings, updateSetting, resolvedTheme, loading }),
    [settings, updateSetting, resolvedTheme, loading],
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeContext must be used within ThemeProvider')
  return ctx
}

export function useSettings() {
  return useThemeContext()
}
