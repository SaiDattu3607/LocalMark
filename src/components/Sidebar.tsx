import { useEffect, useRef, useState } from 'react'
import type { Document } from '../db'
import { getPreviewLine } from '../utils/markdown'

interface SidebarProps {
  documents: Document[]
  starredDocuments: Document[]
  regularDocuments: Document[]
  activeId: string | null
  collapsed: boolean
  searchQuery: string
  onSearchChange: (q: string) => void
  onSelect: (id: string) => void
  onNewDoc: () => void
  onRename: (id: string, title: string) => void
  onToggleStar: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onToggleCollapse: () => void
  onOpenSettings: () => void
}

export function Sidebar({
  starredDocuments,
  regularDocuments,
  activeId,
  collapsed,
  searchQuery,
  onSearchChange,
  onSelect,
  onNewDoc,
  onRename,
  onToggleStar,
  onDuplicate,
  onDelete,
  onToggleCollapse,
  onOpenSettings,
}: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col sidebar-transition border-r border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 shrink-0 ${
          collapsed ? 'w-0 overflow-hidden opacity-0' : 'w-60 opacity-100'
        }`}
      >
        <SidebarContent
          starredDocuments={starredDocuments}
          regularDocuments={regularDocuments}
          activeId={activeId}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onSelect={onSelect}
          onNewDoc={onNewDoc}
          onRename={onRename}
          onToggleStar={onToggleStar}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onOpenSettings={onOpenSettings}
        />
      </aside>

      {/* Collapse toggle (desktop) */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden md:flex items-center justify-center w-5 shrink-0 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-r border-zinc-200 dark:border-zinc-700 text-zinc-400 transition-colors"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '›' : '‹'}
      </button>
    </>
  )
}

function SidebarContent({
  starredDocuments,
  regularDocuments,
  activeId,
  searchQuery,
  onSearchChange,
  onSelect,
  onNewDoc,
  onRename,
  onToggleStar,
  onDuplicate,
  onDelete,
  onOpenSettings,
}: Omit<SidebarProps, 'collapsed' | 'onToggleCollapse' | 'documents'>) {
  return (
    <>
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">LocalMark</span>
        </div>
        <input
          type="search"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={onNewDoc}
          className="w-full mt-2 px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          + New Document
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {starredDocuments.length > 0 && (
          <DocSection title="Starred">
            {starredDocuments.map((doc) => (
              <DocItem
                key={doc.id}
                doc={doc}
                active={doc.id === activeId}
                onSelect={onSelect}
                onRename={onRename}
                onToggleStar={onToggleStar}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))}
          </DocSection>
        )}
        <DocSection title={starredDocuments.length > 0 ? 'All Documents' : undefined}>
          {regularDocuments.map((doc) => (
            <DocItem
              key={doc.id}
              doc={doc}
              active={doc.id === activeId}
              onSelect={onSelect}
              onRename={onRename}
              onToggleStar={onToggleStar}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </DocSection>
        {starredDocuments.length === 0 && regularDocuments.length === 0 && (
          <p className="px-3 py-4 text-sm text-zinc-400 text-center">No documents found</p>
        )}
      </div>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400"
        >
          <span>⚙</span> Settings
        </button>
      </div>
    </>
  )
}

function DocSection({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="py-1">
      {title && (
        <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

function DocItem({
  doc,
  active,
  onSelect,
  onRename,
  onToggleStar,
  onDuplicate,
  onDelete,
}: {
  doc: Document
  active: boolean
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onToggleStar: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(doc.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        className={`w-full text-left px-3 py-2 border-l-2 transition-colors ${
          active
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
            : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <div className="flex items-center gap-1">
          {doc.starred && <span className="text-yellow-500 text-xs">★</span>}
          <span className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-100">
            {doc.title}
          </span>
        </div>
        <div className="text-xs text-zinc-400 truncate mt-0.5">
          {getPreviewLine(doc.body)}
        </div>
        <div className="text-xs text-zinc-400 mt-0.5">
          {formatDate(doc.updatedAt)}
        </div>
      </button>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: 'Rename',
              action: () => {
                const name = prompt('Rename document:', doc.title)
                if (name?.trim()) onRename(doc.id, name.trim())
              },
            },
            {
              label: doc.starred ? 'Unstar' : 'Star',
              action: () => onToggleStar(doc.id),
            },
            { label: 'Duplicate', action: () => onDuplicate(doc.id) },
            {
              label: 'Delete',
              action: () => setConfirmDelete(true),
              danger: true,
            },
          ]}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete document?"
          message={`Are you sure you want to delete "${doc.title}"? This cannot be undone.`}
          onConfirm={() => {
            onDelete(doc.id)
            setConfirmDelete(false)
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: { label: string; action: () => void; danger?: boolean }[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-36"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => {
            item.action()
            onClose()
          }}
          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
            item.danger ? 'text-red-600 dark:text-red-400' : ''
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
