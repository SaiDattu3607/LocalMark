import { useCallback, useEffect, useRef, useState } from 'react'
import { getSetting, setSetting } from '../db'
import { DEFAULT_SYSTEM_PROMPT, parseEditBlocks, type ParsedEdit } from '../utils/markdown'
import { useAIContext } from '../context/AIContext'
import { useSettings } from '../context/ThemeContext'
import type { OllamaChatMessage } from '../context/AIContext'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  edits?: ParsedEdit[]
}

const MAX_HISTORY = 10

export function useAI(documentId: string | null, documentBody: string) {
  const {
    isReady,
    error: engineError,
    streamChat,
    checkConnection,
  } = useAIContext()
  const { settings } = useSettings()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const documentBodyRef = useRef(documentBody)

  documentBodyRef.current = documentBody

  useEffect(() => {
    if (!documentId) {
      setMessages([])
      return
    }
    getSetting<ChatMessage[]>(`ai-history:${documentId}`).then((history) => {
      setMessages(history ?? [])
    })
  }, [documentId])

  const persistHistory = useCallback(
    async (history: ChatMessage[]) => {
      if (!documentId) return
      await setSetting(`ai-history:${documentId}`, history.slice(-MAX_HISTORY))
    },
    [documentId],
  )

  const clearConversation = useCallback(async () => {
    setMessages([])
    setStreamingText('')
    setError(null)
    if (documentId) await setSetting(`ai-history:${documentId}`, [])
  }, [documentId])

  const systemPrompt =
    settings.customSystemPrompt.trim() || DEFAULT_SYSTEM_PROMPT

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!isReady || !userMessage.trim() || streaming) return

      setError(null)
      const controller = new AbortController()
      abortRef.current = controller
      setStreaming(true)
      setStreamingText('')

      const userMsg: ChatMessage = { role: 'user', content: userMessage }
      const historyForModel = [...messages, userMsg].slice(-MAX_HISTORY)

      const body = documentBodyRef.current

      // Build Ollama-compatible messages array
      const ollamaMessages: OllamaChatMessage[] = [
        {
          role: 'system',
          content: `${systemPrompt}\n\n--- DOCUMENT ---\n${body}\n--- END DOCUMENT ---`,
        },
        ...historyForModel.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ]

      try {
        const fullResponse = await streamChat(
          settings.aiModel,
          ollamaMessages,
          (accumulated) => {
            if (!controller.signal.aborted) {
              setStreamingText(accumulated)
            }
          },
          controller.signal,
        )

        const edits = parseEditBlocks(fullResponse, body)
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: fullResponse,
          edits: edits.length > 0 ? edits : undefined,
        }

        const newHistory = [...messages, userMsg, assistantMsg].slice(-MAX_HISTORY)
        setMessages(newHistory)
        await persistHistory(newHistory)
      } catch (err) {
        if (controller.signal.aborted) return
        const raw =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : String(err)
        if (!engineError) {
          setError(raw || 'AI request failed — check if Ollama is running.')
        }
      } finally {
        setStreaming(false)
        setStreamingText('')
        abortRef.current = null
      }
    },
    [isReady, streaming, messages, systemPrompt, persistHistory, streamChat, engineError, settings.aiModel],
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    messages,
    streaming,
    streamingText,
    // Engine-level errors (connection failures) take priority
    // because they are more actionable than a generic inference error.
    error: engineError ?? error,
    isReady,
    sendMessage,
    clearConversation,
    checkConnection,
    stopStreaming,
  }
}
