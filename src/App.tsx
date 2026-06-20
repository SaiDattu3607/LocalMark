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
import { AppModeProvider, useAppMode } from './context/AppModeContext'
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
type GateMode = 'TRIAL' | 'LICENSED' | 'EXPIRED'

const PRICING_URL = 'https://racex.in/pricing'

export default function App() {
  return (
    <AppModeProvider>
      <AppShell />
    </AppModeProvider>
  )
}

function AppShell() {
  const { showToast } = useToast()
  const { settings, updateSetting, loading: settingsLoading } = useSettings()
  const {
    mode,
    daysLeft,
    appState,
    loading: appModeLoading,
    updateAppState,
  } = useAppMode()
  const docs = useDocuments({
    onError: (msg) => showToast(msg, 'error'),
  })

  const editorRef = useRef<EditorHandle | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [aiBlockedOpen, setAiBlockedOpen] = useState(false)
  const [warningOpen, setWarningOpen] = useState(false)
  const [trialBannerVisible, setTrialBannerVisible] = useState(true)
  const [unlockOverlayVisible, setUnlockOverlayVisible] = useState(false)
  const [showEditor, setShowEditor] = useState(true)
  const [showRightPane, setShowRightPane] = useState(true)
  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>('preview')
  const [rightPaneWidth, setRightPaneWidth] = useState(50)
  const [mobileTab, setMobileTab] = useState<MobileTab>('editor')
  const draggingRef = useRef(false)

  const isExpired = mode === 'EXPIRED'
  const showPreview = showRightPane && rightPaneMode === 'preview'
  const showAI = !isExpired && showRightPane && rightPaneMode === 'ai'

  const showUnlockOverlay = () => {
    setUnlockOverlayVisible(true)
    window.setTimeout(() => setUnlockOverlayVisible(false), 2000)
  }

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
    if (isExpired) {
      setAiBlockedOpen(true)
      return
    }
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
    if (
      mode === 'TRIAL' &&
      daysLeft === 1 &&
      appState &&
      !appState.shownExpiryWarning
    ) {
      window.setTimeout(() => setWarningOpen(true), 0)
      updateAppState({ shownExpiryWarning: true })
    }
  }, [appState, daysLeft, mode, updateAppState])

  const createDocument = useCallback(
    async (body?: string, title?: string) => {
      if (isExpired) {
        showToast('Upgrade to create documents', 'error')
        return null
      }
      return docs.createDocument(body, title)
    },
    [docs, isExpired, showToast],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          createDocument()
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
          if (isExpired) {
            setAiBlockedOpen(true)
          } else {
            setShowRightPane(true)
            setRightPaneMode('ai')
            setMobileTab('ai')
          }
          break
        case 'b':
          e.preventDefault()
          if (!isExpired) editorRef.current?.wrapSelection('**')
          break
        case 'i':
          e.preventDefault()
          if (!isExpired) editorRef.current?.wrapSelection('*')
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [createDocument, docs, isExpired, showToast])

  const handleImportMd = async (file: File) => {
    if (isExpired) {
      showToast('Upgrade to create documents', 'error')
      return
    }
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
    if (isExpired) {
      showToast('Upgrade to create documents', 'error')
      return
    }
    try {
      const text = await readFileAsText(file)
      const parsed = JSON.parse(text) as { documents?: Document[] } | Document[]
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

  const commonModals = (
    <>
      <ModeBanner
        mode={mode}
        daysLeft={daysLeft}
        trialVisible={trialBannerVisible}
        onDismissTrial={() => setTrialBannerVisible(false)}
      />
      {warningOpen && (
        <TrialWarningModal
          documents={docs.documents}
          onClose={() => setWarningOpen(false)}
        />
      )}
      {aiBlockedOpen && <AIBlockedModal onClose={() => setAiBlockedOpen(false)} />}
      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}
      {unlockOverlayVisible && <UnlockOverlay />}
    </>
  )

  if (docs.loading || settingsLoading || appModeLoading) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        Loading LocalMark...
      </div>
    )
  }

  if (docs.documents.length === 0) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        {commonModals}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-5xl mb-4 font-bold">LocalMark</div>
          <h1 className="text-3xl font-bold mb-2">Welcome to LocalMark</h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mb-6">
            A local-first markdown editor. All your documents, settings, and AI models
            stay on your device - nothing is sent to any server.
          </p>
          {!isExpired ? (
            <button
              type="button"
              onClick={() => createDocument('# Hello LocalMark\n\nStart writing...')}
              className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Create your first document
            </button>
          ) : (
            <button
              type="button"
              onClick={openPricing}
              className="px-6 py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
            >
              Unlock for $10 -&gt;
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="mt-4 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Settings
          </button>
        </div>
        <Settings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          documents={docs.documents}
          onClearAllDocuments={docs.clearAllDocuments}
          onLicenseActivated={showUnlockOverlay}
        />
        <ToastContainer />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {commonModals}
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
        readOnly={isExpired}
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
          onNewDoc={() => createDocument()}
          onRename={docs.renameDocument}
          onToggleStar={docs.toggleStar}
          onDuplicate={(id) => {
            if (isExpired) {
              showToast('Upgrade to create documents', 'error')
            } else {
              docs.duplicateDocument(id)
            }
          }}
          onDelete={docs.removeDocument}
          onToggleCollapse={toggleSidebar}
          canCreate={!isExpired}
          onOpenPrivacy={() => setPrivacyOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div id="main-panes" className="flex flex-1 min-w-0 min-h-0">
          {showEditor && (
            <div
              className={`relative flex flex-col min-h-0 min-w-0 ${
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
                onChange={(body) => {
                  if (!isExpired) docs.updateDocument({ body })
                }}
                onTitleChange={(title) => {
                  if (!isExpired) docs.updateDocument({ title })
                }}
                readOnly={isExpired}
                editorRef={editorRef}
              />
              {isExpired && (
                <ExpiredEditorOverlay
                  documents={docs.documents}
                  onExport={() => {
                    exportAllDocuments(docs.documents)
                    showToast('All documents exported', 'success')
                  }}
                />
              )}
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
              {showAI && !isExpired && (
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

      <nav className="md:hidden flex border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 shrink-0">
        {(['editor', 'preview', 'ai'] as MobileTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setMobileTab(tab)
              if (tab === 'editor') {
                setShowEditor(true)
              } else if (tab === 'ai' && isExpired) {
                setAiBlockedOpen(true)
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
            {tab === 'ai' ? 'AI' : tab}
          </button>
        ))}
      </nav>

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        documents={docs.documents}
        onClearAllDocuments={docs.clearAllDocuments}
        onLicenseActivated={showUnlockOverlay}
      />
      <ToastContainer />
    </div>
  )
}

function ModeBanner({
  mode,
  daysLeft,
  trialVisible,
  onDismissTrial,
}: {
  mode: GateMode
  daysLeft: number
  trialVisible: boolean
  onDismissTrial: () => void
}) {
  if (mode === 'LICENSED') return null
  if (mode === 'TRIAL' && !trialVisible) return null

  if (mode === 'EXPIRED') {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-red-600 text-white text-sm shrink-0">
        <span className="font-medium">Your trial has ended - upgrade to keep writing</span>
        <button
          type="button"
          onClick={openPricing}
          className="ml-auto px-3 py-1 rounded bg-white text-red-700 font-medium hover:bg-red-50"
        >
          Unlock for $10 -&gt;
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-yellow-100 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100 text-sm shrink-0">
      <span className="font-medium">
        Trial: {daysLeft} {daysLeft === 1 ? 'day' : 'days'} remaining - Own LocalMark forever for $10
      </span>
      <button
        type="button"
        onClick={openPricing}
        className="ml-auto px-3 py-1 rounded bg-yellow-500 text-yellow-950 font-medium hover:bg-yellow-400"
      >
        Buy now -&gt;
      </button>
      <button
        type="button"
        onClick={onDismissTrial}
        className="px-2 text-lg leading-none hover:text-yellow-700"
        aria-label="Dismiss trial banner"
      >
        x
      </button>
    </div>
  )
}

function ExpiredEditorOverlay({
  documents,
  onExport,
}: {
  documents: Document[]
  onExport: () => void
}) {
  const documentCount = documents.length

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/65 dark:bg-zinc-950/65 backdrop-blur-sm">
      <div className="mx-4 max-w-sm rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-zinc-900 p-5 text-center shadow-lg">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Your {documentCount} {documentCount === 1 ? 'document is' : 'documents are'} safe.
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Upgrade to continue writing.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={openPricing}
            className="px-4 py-2 rounded bg-red-600 text-white font-medium hover:bg-red-700"
          >
            Unlock for $10 -&gt;
          </button>
          <button
            type="button"
            onClick={onExport}
            className="px-4 py-2 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Export all my notes
          </button>
        </div>
      </div>
    </div>
  )
}

function TrialWarningModal({
  documents,
  onClose,
}: {
  documents: Document[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-2">Your trial ends tomorrow</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Export your notes as a backup, or upgrade to keep full access.
        </p>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => exportAllDocuments(documents)}
            className="px-3 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700"
          >
            Export all notes
          </button>
          <button
            type="button"
            onClick={openPricing}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Upgrade for $10 -&gt;
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}

function AIBlockedModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
        <h3 className="text-lg font-semibold mb-2">AI is a Pro feature</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Upgrade to use it.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={openPricing}
            className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
          >
            Unlock for $10 -&gt;
          </button>
        </div>
      </div>
    </div>
  )
}

function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 max-w-lg mx-4">
        <h3 className="text-lg font-semibold mb-4">Your privacy, guaranteed</h3>
        <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <p>✓ Documents live only in this browser (IndexedDB)</p>
          <p>✓ AI runs on your machine via Ollama - never in the cloud</p>
          <p>✓ Zero analytics, zero telemetry, zero tracking</p>
          <p>
            ✓ The only time LocalMark ever contacts a server: once, when you
            activate your license key. One request to racex.in to verify the key
            is real. After that - never again. Forever.
          </p>
          <p>✓ Your documents are never sent anywhere. Ever.</p>
        </div>
        <div className="mt-5 text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">Verify it yourself:</p>
          <p>• Open DevTools (F12) - Network tab - use the app - see zero requests</p>
          <p>• Read the source code: github.com/racex-in/localmark</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 justify-end">
          <a
            href="https://localmark.in/trust"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700"
          >
            Full privacy policy -&gt;
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

function UnlockOverlay() {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-green-950/70 text-white">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-4xl">
          ✓
        </div>
        <p className="text-2xl font-semibold">LocalMark unlocked! Welcome.</p>
      </div>
    </div>
  )
}

function openPricing() {
  window.open(PRICING_URL, '_blank', 'noopener,noreferrer')
}
