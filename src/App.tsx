import { useCallback, useEffect, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Editor, type EditorHandle } from './components/Editor'
import { Preview } from './components/Preview'
import { AIPanel } from './components/AIPanel'
import { Toolbar } from './components/Toolbar'
import { Settings } from './components/Settings'
import { ToastContainer } from './components/ToastContainer'
import { useToast } from './components/Toast'
import { useDocuments } from './hooks/useDocuments'
import { useSettings } from './context/ThemeContext'
import {
  copyMarkdown,
  downloadMarkdown,
  exportAllDocuments,
  readFileAsText,
} from './utils/export'
import { extractTitleFromBody } from './utils/markdown'
import type { Document } from './db'

type MobileTab = 'editor' | 'preview' | 'ai'
type RightPaneMode = 'preview' | 'ai'

export default function App() {
  const { showToast } = useToast()
  const { settings, updateSetting, loading: settingsLoading } = useSettings()
  const docs = useDocuments({
    onError: (msg) => showToast(msg, 'error'),
  })

  const editorRef = useRef<EditorHandle | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showEditor, setShowEditor] = useState(true)
  const [showRightPane, setShowRightPane] = useState(true)
  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>('preview')
  const [rightPaneWidth, setRightPaneWidth] = useState(50)
  const showPreview = showRightPane && rightPaneMode === 'preview'
  const showAI = showRightPane && rightPaneMode === 'ai'

  const [mobileTab, setMobileTab] = useState<MobileTab>('editor')
  const draggingRef = useRef(false)

  const togglePreview = () => {
    if (showPreview) {
      setShowRightPane(false)
    } else {
      setShowRightPane(true)
      setRightPaneMode('preview')
      setMobileTab('preview')
    }
  }

  const toggleAI = () => {
    if (showAI) {
      setShowRightPane(false)
    } else {
      setShowRightPane(true)
      setRightPaneMode('ai')
      setMobileTab('ai')
    }
  }

  const toggleEditor = () => {
    setShowEditor((v) => !v)
    if (showEditor && !showRightPane) {
      setShowRightPane(true)
      setRightPaneMode('preview')
    }
  }

  const handleDividerMouseDown = useCallback(() => {
    draggingRef.current = true
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const container = document.getElementById('main-panes')
      if (!container) return
      const rect = container.getBoundingClientRect()
      const pct = ((rect.right - e.clientX) / rect.width) * 100
      setRightPaneWidth(Math.min(70, Math.max(20, pct)))
    }
    const onMouseUp = () => {
      draggingRef.current = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          docs.createDocument()
          break
        case 's':
          e.preventDefault()
          docs.manualSave().then(() => showToast('Document saved', 'success'))
          break
        case 'p':
          e.preventDefault()
          window.print()
          break
        case '/':
          e.preventDefault()
          setShowRightPane(true)
          setRightPaneMode('ai')
          setMobileTab('ai')
          break
        case 'b':
          e.preventDefault()
          editorRef.current?.wrapSelection('**')
          break
        case 'i':
          e.preventDefault()
          editorRef.current?.wrapSelection('*')
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [docs, showToast])

  const handleImportMd = async (file: File) => {
    try {
      const body = await readFileAsText(file)
      const title = extractTitleFromBody(body, file.name.replace(/\.md$/i, ''))
      await docs.createDocument(body, title)
      showToast('Document imported', 'success')
    } catch {
      showToast('Failed to import file', 'error')
    }
  }

  const handleImportJson = async (file: File) => {
    try {
      const text = await readFileAsText(file)
      const parsed = JSON.parse(text)
      const imported: Document[] = Array.isArray(parsed)
        ? parsed
        : parsed.documents ?? []
      if (!Array.isArray(imported)) throw new Error('Invalid format')
      await docs.importDocuments(imported)
      showToast('Backup restored', 'success')
    } catch {
      showToast('Failed to restore backup', 'error')
    }
  }

  const toggleSidebar = () => {
    updateSetting('sidebarCollapsed', !settings.sidebarCollapsed)
  }

  if (docs.loading || settingsLoading) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        Loading LocalMark...
      </div>
    )
  }

  if (docs.documents.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-zinc-950 text-center px-6">
        <div className="text-5xl mb-4">📝</div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          Welcome to LocalMark
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mb-6">
          A local-first markdown editor. All your documents, settings, and AI models
          stay on your device — nothing is sent to any server.
        </p>
        <button
          type="button"
          onClick={() => docs.createDocument('# Hello LocalMark\n\nStart writing...')}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Create your first document
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="mt-4 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Settings
        </button>
        <Settings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          documents={docs.documents}
          onClearAllDocuments={docs.clearAllDocuments}
        />
        <ToastContainer />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Toolbar
        editorRef={editorRef}
        activeDocument={docs.activeDocument}
        saveStatus={docs.saveStatus}
        showPreview={showPreview}
        showEditor={showEditor}
        showAI={showAI}
        onTogglePreview={togglePreview}
        onToggleEditor={toggleEditor}
        onToggleAI={toggleAI}
        onManualSave={() =>
          docs.manualSave().then(() => showToast('Document saved', 'success'))
        }
        onDownloadMd={() => {
          if (docs.activeDocument) {
            downloadMarkdown(docs.activeDocument)
            showToast('Markdown downloaded', 'success')
          }
        }}
        onCopyMarkdown={async () => {
          if (docs.activeDocument) {
            await copyMarkdown(docs.activeDocument.body)
            showToast('Markdown copied', 'success')
          }
        }}
        onExportAll={() => {
          exportAllDocuments(docs.documents)
          showToast('All documents exported', 'success')
        }}
        onPrint={() => window.print()}
        onImportMd={handleImportMd}
        onImportJson={handleImportJson}
      />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          documents={docs.documents}
          starredDocuments={docs.starredDocuments}
          regularDocuments={docs.regularDocuments}
          activeId={docs.activeId}
          collapsed={settings.sidebarCollapsed}
          searchQuery={docs.searchQuery}
          onSearchChange={docs.setSearchQuery}
          onSelect={docs.setActiveId}
          onNewDoc={() => docs.createDocument()}
          onRename={docs.renameDocument}
          onToggleStar={docs.toggleStar}
          onDuplicate={docs.duplicateDocument}
          onDelete={docs.removeDocument}
          onToggleCollapse={toggleSidebar}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div id="main-panes" className="flex flex-1 min-w-0 min-h-0">
          {showEditor && (
            <div
              className={`flex flex-col min-h-0 min-w-0 ${
                mobileTab !== 'editor' ? 'hidden md:flex' : 'flex'
              } ${showRightPane ? 'border-r border-zinc-200 dark:border-zinc-700' : 'flex-1'}`}
              style={
                showRightPane
                  ? { width: `${100 - rightPaneWidth}%`, flex: 'none' }
                  : { flex: 1 }
              }
            >
              <Editor
                document={docs.activeDocument}
                externalBodyVersion={docs.externalBodyVersion}
                externalBody={docs.activeDocument?.body}
                onChange={(body) => docs.updateDocument({ body })}
                onTitleChange={(title) => docs.updateDocument({ title })}
                editorRef={editorRef}
              />
            </div>
          )}

          {showEditor && showRightPane && (
            <div
              onMouseDown={handleDividerMouseDown}
              className="hidden md:block w-1 cursor-col-resize bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-400 transition-colors shrink-0"
            />
          )}

          {showRightPane && (
            <div
              className={`flex flex-col min-h-0 min-w-0 flex-1 ${
                mobileTab === 'editor' ? 'hidden md:flex' : 'flex'
              }`}
              style={showEditor ? { width: `${rightPaneWidth}%`, flex: 'none' } : undefined}
            >
              {showPreview && (
                <div className={`flex-1 min-h-0 ${mobileTab === 'ai' ? 'hidden md:block' : ''}`}>
                  <Preview body={docs.activeDocument?.body ?? ''} />
                </div>
              )}
              {showAI && (
                <div className={`flex-1 min-h-0 ${mobileTab === 'preview' ? 'hidden md:block' : ''}`}>
                  <AIPanel
                    documentId={docs.activeId}
                    documentBody={docs.activeDocument?.body ?? ''}
                    onApplyEdit={(body) => docs.updateDocument({ body }, true)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden flex border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 shrink-0">
        {(['editor', 'preview', 'ai'] as MobileTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setMobileTab(tab)
              if (tab === 'editor') {
                setShowEditor(true)
              } else {
                setShowRightPane(true)
                setRightPaneMode(tab === 'preview' ? 'preview' : 'ai')
              }
            }}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
              mobileTab === tab
                ? 'text-blue-600 dark:text-blue-400 border-t-2 border-blue-600'
                : 'text-zinc-500'
            }`}
          >
            {tab === 'ai' ? '✨ AI' : tab}
          </button>
        ))}
      </nav>

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        documents={docs.documents}
        onClearAllDocuments={docs.clearAllDocuments}
      />
      <ToastContainer />
    </div>
  )
}
