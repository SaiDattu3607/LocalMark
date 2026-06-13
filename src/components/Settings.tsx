import { useEffect, useState } from 'react'
import { DEFAULT_SYSTEM_PROMPT } from '../utils/markdown'
import { useSettings } from '../context/ThemeContext'
import { useAIContext, type OllamaModel } from '../context/AIContext'
import { getAllSettings } from '../db'
import { exportAllData } from '../utils/export'
import type { Document } from '../db'

interface SettingsProps {
  open: boolean
  onClose: () => void
  documents: Document[]
  onClearAllDocuments: () => Promise<void>
}

export function Settings({
  open,
  onClose,
  documents,
  onClearAllDocuments,
}: SettingsProps) {
  const { settings, updateSetting } = useSettings()
  const { isConnected, installedModels, checkConnection } = useAIContext()
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [modelInput, setModelInput] = useState(settings.aiModel)

  // Keep local model input in sync with settings
  useEffect(() => {
    setModelInput(settings.aiModel)
  }, [settings.aiModel])

  if (!open) return null

  const handleModelChange = async (model: string) => {
    const trimmed = model.trim()
    if (!trimmed || trimmed === settings.aiModel) return
    await updateSetting('aiModel', trimmed)
  }

  const handleExportAll = async () => {
    const allSettings = await getAllSettings()
    exportAllData(documents, allSettings)
    onClose()
  }

  const handleSelectInstalledModel = async (model: OllamaModel) => {
    setModelInput(model.name)
    await updateSetting('aiModel', model.name)
  }

  const formatModelSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    if (gb >= 1) return `${gb.toFixed(1)} GB`
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(0)} MB`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <SettingGroup title="Appearance">
            <SettingRow label="Theme">
              <select
                value={settings.theme}
                onChange={(e) => updateSetting('theme', e.target.value as 'light' | 'dark' | 'system')}
                className="setting-select"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </SettingRow>
          </SettingGroup>

          <SettingGroup title="Editor">
            <SettingRow label="Font size">
              <select
                value={settings.editorFontSize}
                onChange={(e) => updateSetting('editorFontSize', e.target.value as '13px' | '15px' | '17px')}
                className="setting-select"
              >
                <option value="13px">13px</option>
                <option value="15px">15px</option>
                <option value="17px">17px</option>
              </select>
            </SettingRow>
            <SettingRow label="Font">
              <select
                value={settings.editorFont}
                onChange={(e) => updateSetting('editorFont', e.target.value as 'monospace' | 'sans-serif')}
                className="setting-select"
              >
                <option value="monospace">Monospace</option>
                <option value="sans-serif">Sans-serif</option>
              </select>
            </SettingRow>
          </SettingGroup>

          <SettingGroup title="Preview">
            <SettingRow label="Font size">
              <select
                value={settings.previewFontSize}
                onChange={(e) => updateSetting('previewFontSize', e.target.value as '13px' | '15px' | '17px')}
                className="setting-select"
              >
                <option value="13px">13px</option>
                <option value="15px">15px</option>
                <option value="17px">17px</option>
              </select>
            </SettingRow>
          </SettingGroup>

          <SettingGroup title="AI (Ollama)">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {isConnected ? 'Connected to Ollama' : 'Ollama not running'}
              </span>
              <button
                type="button"
                onClick={checkConnection}
                className="ml-auto text-xs text-purple-600 dark:text-purple-400 hover:underline"
              >
                Refresh
              </button>
            </div>

            <div>
              <label className="block text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                Model name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  onBlur={() => handleModelChange(modelInput)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleModelChange(modelInput)
                  }}
                  placeholder="e.g. llama3.2:1b"
                  className="flex-1 px-3 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                />
              </div>
            </div>

            {isConnected && installedModels.length > 0 && (
              <div>
                <label className="block text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                  Installed models
                </label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {installedModels.map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => handleSelectInstalledModel(m)}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded border transition-colors ${
                        settings.aiModel === m.name
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300'
                          : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                      }`}
                    >
                      <span className="font-mono">{m.name}</span>
                      <span className="text-xs text-zinc-400 ml-2">
                        ({formatModelSize(m.size)})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isConnected && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 rounded p-3 space-y-1">
                <p className="font-medium">Start Ollama with CORS enabled:</p>
                <code className="block bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 font-mono whitespace-pre-wrap">
                  {`# Windows PowerShell\n$env:OLLAMA_ORIGINS="*"; ollama serve\n\n# Mac/Linux\nOLLAMA_ORIGINS="*" ollama serve`}
                </code>
              </div>
            )}

            <div>
              <label className="block text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                Custom system prompt
              </label>
              <textarea
                value={settings.customSystemPrompt}
                onChange={(e) => updateSetting('customSystemPrompt', e.target.value)}
                rows={4}
                placeholder={DEFAULT_SYSTEM_PROMPT}
                className="w-full px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => updateSetting('customSystemPrompt', '')}
                className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reset to default
              </button>
            </div>
          </SettingGroup>

          <SettingGroup title="Data">
            <button
              type="button"
              onClick={handleExportAll}
              className="w-full px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Export all data
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="w-full px-3 py-2 text-sm rounded border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              Delete all documents
            </button>
          </SettingGroup>
        </div>
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete all documents?</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
              This will permanently delete all documents. Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 mb-4 outline-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowDeleteDialog(false); setDeleteConfirm('') }}
                className="px-3 py-1.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirm !== 'DELETE'}
                onClick={async () => {
                  await onClearAllDocuments()
                  setShowDeleteDialog(false)
                  setDeleteConfirm('')
                  onClose()
                }}
                className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function SettingRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </div>
  )
}
