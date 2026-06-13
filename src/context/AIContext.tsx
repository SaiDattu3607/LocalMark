import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

export interface OllamaModel {
  name: string
  size: number
  modified_at: string
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIContextValue {
  isConnected: boolean
  isReady: boolean
  installedModels: OllamaModel[]
  error: string | null
  checkConnection: () => Promise<void>
  streamChat: (
    model: string,
    messages: OllamaChatMessage[],
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ) => Promise<string>
  clearError: () => void
  ollamaUrl: string
  updateOllamaUrl: (url: string) => void
}

const AIContext = createContext<AIContextValue | null>(null)

/**
 * Check if Ollama is reachable and return the list of installed models.
 */
async function fetchInstalledModels(
  baseUrl: string,
): Promise<OllamaModel[] | null> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.models ?? []) as OllamaModel[]
  } catch {
    return null
  }
}

/**
 * Stream a chat completion from Ollama.
 * Each line of the response is a JSON object (NDJSON):
 *   { "message": { "content": "..." }, "done": false }
 * The stream ends when "done": true.
 */
async function ollamaStreamChat(
  baseUrl: string,
  model: string,
  messages: OllamaChatMessage[],
  onChunk: (accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Ollama error (${res.status}): ${errText}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body from Ollama')

  const decoder = new TextDecoder()
  let accumulated = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines (NDJSON)
      const lines = buffer.split('\n')
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const parsed = JSON.parse(trimmed)
          if (parsed.message?.content) {
            accumulated += parsed.message.content
            onChunk(accumulated)
          }
          if (parsed.done) {
            return accumulated
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim())
        if (parsed.message?.content) {
          accumulated += parsed.message.content
          onChunk(accumulated)
        }
      } catch {
        // ignore
      }
    }
  } finally {
    reader.releaseLock()
  }

  return accumulated
}

function formatOllamaError(err: unknown, model?: string): string {
  const msg = err instanceof Error ? err.message : String(err)

  if (/fetch|network|ECONNREFUSED|Failed to fetch/i.test(msg)) {
    return 'Cannot connect to Ollama. Make sure it is running with CORS enabled:\n$env:OLLAMA_ORIGINS="*"; ollama serve'
  }
  if (/404|not found/i.test(msg)) {
    return `Model "${model || 'unknown'}" not found. Pull it first with: ollama pull ${model || '<model-name>'}`
  }
  if (/timeout|abort/i.test(msg)) {
    return 'Request timed out. Ollama may be busy loading the model — try again in a moment.'
  }
  return msg || 'Unknown Ollama error'
}

export function AIProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ollamaUrl, setOllamaUrl] = useState(DEFAULT_OLLAMA_URL)
  const mountedRef = useRef(true)

  const clearError = useCallback(() => setError(null), [])

  const checkConnection = useCallback(async () => {
    // Read the URL from settings stored in IDB
    // For now, we read it from a known key; ThemeContext will provide it
    const url = ollamaUrl
    const models = await fetchInstalledModels(url)
    if (!mountedRef.current) return

    if (models !== null) {
      setIsConnected(true)
      setInstalledModels(models)
      setError(null)
    } else {
      setIsConnected(false)
      setInstalledModels([])
      setError(
        'Ollama is not running. Start it with:\n$env:OLLAMA_ORIGINS="*"; ollama serve',
      )
    }
  }, [ollamaUrl])

  // Update the internal URL when ThemeContext settings change.
  // AIProvider reads this via a setter exposed on context.
  const updateOllamaUrl = useCallback((url: string) => {
    setOllamaUrl(url || DEFAULT_OLLAMA_URL)
  }, [])

  // Check connection on mount
  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  const streamChat = useCallback(
    async (
      model: string,
      messages: OllamaChatMessage[],
      onChunk: (text: string) => void,
      signal?: AbortSignal,
    ): Promise<string> => {
      if (!isConnected) {
        throw new Error('Ollama is not connected')
      }
      try {
        return await ollamaStreamChat(ollamaUrl, model, messages, onChunk, signal)
      } catch (err) {
        const formatted = formatOllamaError(err, model)
        // Only set engine-level error for connection issues, not model-not-found
        const raw = err instanceof Error ? err.message : String(err)
        const isModelError = /404|not found/i.test(raw)
        if (mountedRef.current && !isModelError) {
          setError(formatted)
        }
        throw new Error(formatted)
      }
    },
    [isConnected, ollamaUrl],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const value = useMemo(
    () => ({
      isConnected,
      isReady: isConnected,
      installedModels,
      error,
      checkConnection,
      streamChat,
      clearError,
      ollamaUrl,
      updateOllamaUrl,
    }),
    [
      isConnected,
      installedModels,
      error,
      checkConnection,
      streamChat,
      clearError,
      ollamaUrl,
      updateOllamaUrl,
    ],
  )

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>
}

export function useAIContext() {
  const ctx = useContext(AIContext)
  if (!ctx) throw new Error('useAIContext must be used within AIProvider')
  return ctx
}
