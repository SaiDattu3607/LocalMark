import { useEffect, useRef, useState } from 'react'
import { useAI } from '../hooks/useAI'
import { useSettings } from '../context/ThemeContext'
import { useAIContext } from '../context/AIContext'
import { DiffView } from './DiffView'
import { applyEdit } from '../utils/markdown'
import { useToast } from './Toast'

interface AIPanelProps {
  documentId: string | null
  documentBody: string
  onApplyEdit: (newBody: string) => void
}

export function AIPanel({ documentId, documentBody, onApplyEdit }: AIPanelProps) {
  const { settings, updateSetting } = useSettings()
  const { installedModels, isConnected: ollamaConnected } = useAIContext()
  const { showToast } = useToast()
  const {
    messages,
    streaming,
    streamingText,
    error,
    isReady,
    sendMessage,
    clearConversation,
    checkConnection,
    stopStreaming,
  } = useAI(documentId, documentBody)

  const [input, setInput] = useState('')
  const [discardedEdits, setDiscardedEdits] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevReady = useRef(false)

  useEffect(() => {
    if (isReady && !prevReady.current) {
      showToast('Connected to Ollama', 'success')
    }
    prevReady.current = isReady
  }, [isReady, showToast])

  // Auto-select first installed model if the configured model isn't available
  useEffect(() => {
    if (ollamaConnected && installedModels.length > 0) {
      const modelExists = installedModels.some(m => m.name === settings.aiModel)
      if (!modelExists) {
        updateSetting('aiModel', installedModels[0].name)
      }
    }
  }, [ollamaConnected, installedModels, settings.aiModel, updateSetting])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, streamingText])

  // Not connected — show setup instructions
  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-4xl mb-4">🦙</div>
        <h3 className="text-lg font-semibold mb-2">Local AI Assistant</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 max-w-xs">
          Run AI entirely on your computer with Ollama — no data ever leaves your device.
        </p>

        {error && (
          <div className="mb-4 space-y-3 max-w-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              ⚠️ Ollama not running
            </p>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 text-left space-y-2">
              <p className="font-medium">Setup steps:</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>
                  Install Ollama from{' '}
                  <a
                    href="https://ollama.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 underline"
                  >
                    ollama.com
                  </a>
                </li>
                <li>Pull a model:</li>
              </ol>
              <code className="block bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 text-xs font-mono">
                ollama pull {settings.aiModel}
              </code>
              <ol className="list-decimal list-inside" start={3}>
                <li>Start with CORS enabled:</li>
              </ol>
              <code className="block bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 text-xs font-mono whitespace-pre-wrap">
                {`# Windows PowerShell\n$env:OLLAMA_ORIGINS="*"; ollama serve\n\n# Mac/Linux\nOLLAMA_ORIGINS="*" ollama serve`}
              </code>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={checkConnection}
          className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors font-medium"
        >
          Check connection
        </button>
      </div>
    )
  }

  const handleSend = async () => {
    if (!input.trim() || streaming) return
    const msg = input.trim()
    setInput('')
    try {
      await sendMessage(msg)
    } catch {
      showToast('AI request failed', 'error')
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Connected to Ollama" />
          <span className="text-sm font-medium">AI Assistant</span>
          <span className="text-xs text-zinc-400">({settings.aiModel})</span>
        </div>
        <button
          type="button"
          onClick={clearConversation}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Clear conversation
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
        {messages.length === 0 && !streaming && (
          <p className="text-sm text-zinc-400 text-center py-8">
            Ask the AI to help edit your document. Suggested edits appear with Apply/Discard buttons.
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
            <div
              className={`inline-block max-w-[90%] px-3 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
              }`}
            >
              <MessageContent content={msg.content.replace(/<edit>[\s\S]*?<\/edit>/gi, '[edit suggestion below]')} />
            </div>

            {msg.edits?.map((edit, j) => {
              const key = `${i}-${j}`
              if (discardedEdits.has(key)) return null
              return (
                <DiffView
                  key={key}
                  originalText={edit.originalText}
                  newText={edit.newText}
                  onApply={() => {
                    const newBody = applyEdit(documentBody, edit.originalText, edit.newText)
                    onApplyEdit(newBody)
                    setDiscardedEdits((prev) => new Set(prev).add(key))
                    showToast('Edit applied', 'success')
                  }}
                  onDiscard={() => {
                    setDiscardedEdits((prev) => new Set(prev).add(key))
                  }}
                />
              )
            })}
          </div>
        ))}

        {streaming && streamingText && (
          <div className="text-sm">
            <div className="inline-block max-w-[90%] px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <MessageContent content={streamingText.replace(/<edit>[\s\S]*$/gi, '')} />
              <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-center space-y-2 mx-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-red-600 dark:text-red-400 whitespace-pre-wrap">⚠️ {error}</p>
            <button
              type="button"
              onClick={checkConnection}
              className="px-3 py-1.5 text-sm rounded bg-purple-600 text-white hover:bg-purple-700"
            >
              Reconnect to Ollama
            </button>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask AI to help with your document..."
            disabled={streaming}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
  return (
    <div className="whitespace-pre-wrap break-words">{content}</div>
  )
}
