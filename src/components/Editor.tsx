import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { useSettings } from '../context/ThemeContext'
import type { Document } from '../db'

export interface EditorHandle {
  wrapSelection: (before: string, after?: string) => void
  insertAtCursor: (text: string) => void
  setBody: (body: string) => void
}

interface EditorProps {
  document: Document | null
  onChange: (body: string) => void
  onTitleChange: (title: string) => void
  editorRef?: React.MutableRefObject<EditorHandle | null>
  /** Increment to push external content (AI apply, etc.) into the editor */
  externalBodyVersion?: number
  externalBody?: string
}

function setViewBody(view: EditorView, body: string) {
  const current = view.state.doc.toString()
  if (current === body) return
  view.dispatch({
    changes: { from: 0, to: current.length, insert: body },
    selection: { anchor: body.length },
  })
}

export function Editor({
  document,
  onChange,
  onTitleChange,
  editorRef,
  externalBodyVersion = 0,
  externalBody,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const docIdRef = useRef<string | null>(null)
  const localBodyRef = useRef('')
  const lastExternalVersionRef = useRef(0)
  const { settings, resolvedTheme } = useSettings()
  const [title, setTitle] = useState('')

  onChangeRef.current = onChange

  useEffect(() => {
    setTitle(document?.title ?? '')
  }, [document?.id, document?.title])

  useEffect(() => {
    if (!containerRef.current || !document) return

    const fontFamily =
      settings.editorFont === 'monospace'
        ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        : 'ui-sans-serif, system-ui, sans-serif'

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      markdown(),
      EditorView.lineWrapping,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.theme({
        '&': { height: '100%', fontSize: settings.editorFontSize },
        '.cm-scroller': { fontFamily, overflow: 'auto' },
        '.cm-content': { padding: '16px 0' },
        '.cm-gutters': { minWidth: '40px' },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const text = update.state.doc.toString()
          localBodyRef.current = text
          onChangeRef.current(text)
        }
      }),
    ]

    if (resolvedTheme === 'dark') {
      extensions.push(oneDark)
    }

    const isNewDocument = docIdRef.current !== document.id
    if (isNewDocument) {
      localBodyRef.current = document.body
    }
    docIdRef.current = document.id

    const state = EditorState.create({
      doc: localBodyRef.current || document.body,
      extensions,
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    if (editorRef) {
      editorRef.current = {
        wrapSelection(before: string, after = before) {
          const v = viewRef.current
          if (!v) return
          const { from, to } = v.state.selection.main
          const selected = v.state.sliceDoc(from, to)
          v.dispatch({
            changes: { from, to, insert: `${before}${selected}${after}` },
            selection: {
              anchor: from + before.length + selected.length + after.length,
            },
          })
          v.focus()
        },
        insertAtCursor(text: string) {
          const v = viewRef.current
          if (!v) return
          const pos = v.state.selection.main.head
          v.dispatch({
            changes: { from: pos, insert: text },
            selection: { anchor: pos + text.length },
          })
          v.focus()
        },
        setBody(body: string) {
          const v = viewRef.current
          if (!v) return
          localBodyRef.current = body
          setViewBody(v, body)
        },
      }
    }

    if (!isNewDocument && externalBodyVersion > lastExternalVersionRef.current) {
      lastExternalVersionRef.current = externalBodyVersion
      if (externalBody !== undefined) {
        setViewBody(view, externalBody)
      }
    }

    return () => {
      view.destroy()
      viewRef.current = null
      if (editorRef) editorRef.current = null
    }
  }, [
    document?.id,
    settings.editorFont,
    settings.editorFontSize,
    resolvedTheme,
  ])

  // Push external edits (AI apply) without syncing every React state update
  useEffect(() => {
    if (externalBodyVersion <= lastExternalVersionRef.current) return
    lastExternalVersionRef.current = externalBodyVersion
    const view = viewRef.current
    if (!view || externalBody === undefined) return
    localBodyRef.current = externalBody
    setViewBody(view, externalBody)
  }, [externalBodyVersion, externalBody])

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        Select or create a document
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== document.title) {
              onTitleChange(title.trim())
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
          }}
          className="w-full text-lg font-semibold bg-transparent outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
          placeholder="Document title"
        />
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" />
    </div>
  )
}
