import { useRef, useState } from 'react'
import type { EditorHandle } from './Editor'
import type { Document } from '../db'
import type { SaveStatus } from '../hooks/useDocuments'

type FormatCommand =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'link'
  | 'image'
  | 'code'
  | 'quote'

interface ToolbarProps {
  editorRef: React.MutableRefObject<EditorHandle | null>
  activeDocument: Document | null
  saveStatus: SaveStatus
  showPreview: boolean
  showEditor: boolean
  showAI: boolean
  onTogglePreview: () => void
  onToggleEditor: () => void
  onToggleAI: () => void
  onManualSave: () => void
  onDownloadMd: () => void
  onCopyMarkdown: () => void
  onExportAll: () => void
  onPrint: () => void
  onImportMd: (file: File) => void
  onImportJson: (file: File) => void
  readOnly?: boolean
}

const FORMAT_BUTTONS: {
  label: string
  title: string
  command: FormatCommand
}[] = [
  { label: 'B', title: 'Bold (Ctrl+B)', command: 'bold' },
  { label: 'I', title: 'Italic (Ctrl+I)', command: 'italic' },
  { label: 'H', title: 'Heading', command: 'heading' },
  { label: 'Link', title: 'Link', command: 'link' },
  { label: 'Img', title: 'Image', command: 'image' },
  { label: '</>', title: 'Code', command: 'code' },
  { label: 'Quote', title: 'Quote', command: 'quote' },
]

export function Toolbar({
  editorRef,
  saveStatus,
  showPreview,
  showEditor,
  showAI,
  onTogglePreview,
  onToggleEditor,
  onToggleAI,
  onManualSave,
  onDownloadMd,
  onCopyMarkdown,
  onExportAll,
  onPrint,
  onImportMd,
  onImportJson,
  readOnly = false,
}: ToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const mdInputRef = useRef<HTMLInputElement>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)

  const runFormatCommand = (command: FormatCommand) => {
    if (readOnly) return
    switch (command) {
      case 'bold':
        editorRef.current?.wrapSelection('**')
        break
      case 'italic':
        editorRef.current?.wrapSelection('*')
        break
      case 'heading':
        editorRef.current?.insertAtCursor('\n## ')
        break
      case 'link':
        editorRef.current?.wrapSelection('[', '](url)')
        break
      case 'image':
        editorRef.current?.insertAtCursor('![alt](url)')
        break
      case 'code':
        editorRef.current?.wrapSelection('`')
        break
      case 'quote':
        editorRef.current?.insertAtCursor('\n> ')
        break
    }
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 shrink-0">
      <div className="flex items-center gap-0.5 mr-2">
        {FORMAT_BUTTONS.map((btn) => (
          <button
            key={btn.title}
            type="button"
            title={btn.title}
            onClick={() => runFormatCommand(btn.command)}
            disabled={readOnly}
            className="min-w-8 h-8 px-2 flex items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-600 mx-1" />

      <div className="relative">
        <button
          type="button"
          onClick={() => { setExportOpen(!exportOpen); setImportOpen(false) }}
          className="px-2 py-1 text-xs rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          Export
        </button>
        {exportOpen && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-20 py-1">
            <MenuItem onClick={() => { onDownloadMd(); setExportOpen(false) }}>Download .md</MenuItem>
            <MenuItem onClick={() => { onCopyMarkdown(); setExportOpen(false) }}>Copy markdown</MenuItem>
            <MenuItem onClick={() => { onExportAll(); setExportOpen(false) }}>Export all (JSON)</MenuItem>
            <MenuItem onClick={() => { onPrint(); setExportOpen(false) }}>Print / Save as PDF</MenuItem>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => { setImportOpen(!importOpen); setExportOpen(false) }}
          className="px-2 py-1 text-xs rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          Import
        </button>
        {importOpen && (
          <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-20 py-1">
            <MenuItem onClick={() => { mdInputRef.current?.click(); setImportOpen(false) }}>Import .md file</MenuItem>
            <MenuItem onClick={() => { jsonInputRef.current?.click(); setImportOpen(false) }}>Restore from JSON backup</MenuItem>
          </div>
        )}
      </div>

      <input
        ref={mdInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImportMd(file)
          e.target.value = ''
        }}
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImportJson(file)
          e.target.value = ''
        }}
      />

      <div className="flex-1" />

      <span className="text-xs text-zinc-400 mr-2">
        {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
      </span>
      {readOnly && (
        <span className="text-xs font-medium text-red-600 dark:text-red-400 mr-2">
          Read only
        </span>
      )}

      <button
        type="button"
        title="Toggle editor"
        onClick={onToggleEditor}
        className={`px-2 py-1 text-xs rounded transition-colors ${showEditor ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
      >
        Editor
      </button>
      <button
        type="button"
        title="Toggle preview"
        onClick={onTogglePreview}
        className={`px-2 py-1 text-xs rounded transition-colors ${showPreview ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
      >
        Preview
      </button>
      <button
        type="button"
        title="Toggle AI (Ctrl+/)"
        onClick={onToggleAI}
        className={`px-2 py-1 text-xs rounded transition-colors ${showAI ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
      >
        AI
      </button>

      <button
        type="button"
        title="Manual save (Ctrl+S)"
        onClick={onManualSave}
        className="ml-1 px-2 py-1 text-xs rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
      >
        Save
      </button>
    </div>
  )
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
    >
      {children}
    </button>
  )
}
