import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import {
  deleteDocument,
  deleteAllDocuments,
  getAllDocuments,
  saveDocument,
  type Document,
} from '../db'
import { extractTitleFromBody } from '../utils/markdown'

export type SaveStatus = 'saved' | 'saving' | 'idle'

interface UseDocumentsOptions {
  onError?: (message: string) => void
}

function isNewerInMemory(existing: Document, saved: Document): boolean {
  if (existing.updatedAt > saved.updatedAt) return true
  if (
    existing.updatedAt === saved.updatedAt &&
    existing.body.length > saved.body.length
  ) {
    return true
  }
  return false
}

export function useDocuments({ onError }: UseDocumentsOptions = {}) {
  const [documents, _setDocuments] = useState<Document[]>([])
  const documentsRef = useRef<Document[]>([])

  const setDocuments = useCallback((val: Document[] | ((prev: Document[]) => Document[])) => {
    _setDocuments((prev) => {
      const next = typeof val === 'function' ? val(prev) : val
      documentsRef.current = next
      return next
    })
  }, [])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [searchQuery, setSearchQuery] = useState('')
  const [externalBodyVersion, setExternalBodyVersion] = useState(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingDocRef = useRef<Document | null>(null)
  const loadedRef = useRef(false)

  const activeDocument = documents.find((d) => d.id === activeId) ?? null

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await getAllDocuments()
      setDocuments(docs)
      return docs
    } catch {
      onError?.('Failed to load documents')
      return []
    }
  }, [onError])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadDocuments().then((docs) => {
      if (docs.length > 0) {
        setActiveId((current) => current ?? docs[0].id)
      }
      setLoading(false)
    })
  }, [loadDocuments])

  const persistDocument = useCallback(
    async (doc: Document) => {
      setSaveStatus('saving')
      try {
        const latest = pendingDocRef.current
        const toSave =
          latest && latest.id === doc.id && isNewerInMemory(latest, doc)
            ? latest
            : doc

        await saveDocument(toSave)
        setDocuments((prev) => {
          const existing = prev.find((d) => d.id === toSave.id)
          if (existing && isNewerInMemory(existing, toSave)) {
            return prev
          }
          const filtered = prev.filter((d) => d.id !== toSave.id)
          return [toSave, ...filtered].sort((a, b) => b.updatedAt - a.updatedAt)
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        onError?.('Failed to save document')
        setSaveStatus('idle')
      }
    },
    [onError],
  )

  const debouncedSave = useCallback(
    (doc: Document) => {
      pendingDocRef.current = doc
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      setSaveStatus('saving')
      saveTimerRef.current = setTimeout(() => {
        const pending = pendingDocRef.current
        if (pending) {
          persistDocument(pending)
        }
      }, 800)
    },
    [persistDocument],
  )

  const createDocument = useCallback(
    async (body = '', title = 'Untitled') => {
      const now = Date.now()
      const doc: Document = {
        id: nanoid(),
        title,
        body,
        createdAt: now,
        updatedAt: now,
        starred: false,
      }
      try {
        await saveDocument(doc)
        setDocuments((prev) => [doc, ...prev])
        setActiveId(doc.id)
        return doc
      } catch {
        onError?.('Failed to create document')
        return null
      }
    },
    [onError],
  )

  const updateDocument = useCallback(
    (updates: Partial<Pick<Document, 'title' | 'body' | 'starred'>>, external = false) => {
      if (!activeId) return

      const current = documentsRef.current.find((d) => d.id === activeId)
      if (!current) return

      const updated: Document = {
        ...current,
        ...updates,
        updatedAt: Date.now(),
      }

      if (updates.body !== undefined && updates.title === undefined) {
        const autoTitle = extractTitleFromBody(updates.body, current.title)
        if (current.title === 'Untitled' || !current.title) {
          updated.title = autoTitle
        }
      }

      setDocuments((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      )

      debouncedSave(updated)

      if (external && updates.body !== undefined) {
        setExternalBodyVersion((v) => v + 1)
      }
    },
    [activeId, debouncedSave],
  )

  const manualSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const pending = pendingDocRef.current
    if (pending) {
      await persistDocument(pending)
      pendingDocRef.current = null
    } else if (activeDocument) {
      await persistDocument(activeDocument)
    }
  }, [activeDocument, persistDocument])

  const renameDocument = useCallback(
    async (id: string, title: string) => {
      const doc = documentsRef.current.find((d) => d.id === id)
      if (!doc) return
      const updated = { ...doc, title, updatedAt: Date.now() }
      await persistDocument(updated)
    },
    [persistDocument],
  )

  const toggleStar = useCallback(
    async (id: string) => {
      const doc = documentsRef.current.find((d) => d.id === id)
      if (!doc) return
      const updated = { ...doc, starred: !doc.starred, updatedAt: Date.now() }
      await persistDocument(updated)
    },
    [persistDocument],
  )

  const duplicateDocument = useCallback(
    async (id: string) => {
      const doc = documentsRef.current.find((d) => d.id === id)
      if (!doc) return
      const now = Date.now()
      const copy: Document = {
        ...doc,
        id: nanoid(),
        title: `${doc.title} (copy)`,
        createdAt: now,
        updatedAt: now,
      }
      await saveDocument(copy)
      setDocuments((prev) => [copy, ...prev])
      setActiveId(copy.id)
    },
    [],
  )

  const removeDocument = useCallback(
    async (id: string) => {
      try {
        await deleteDocument(id)
        setDocuments((prev) => {
          const next = prev.filter((d) => d.id !== id)
          if (activeId === id) {
            setActiveId(next[0]?.id ?? null)
          }
          return next
        })
      } catch {
        onError?.('Failed to delete document')
      }
    },
    [activeId, onError],
  )

  const importDocuments = useCallback(
    async (imported: Document[]) => {
      const merged = new Map(documentsRef.current.map((d) => [d.id, d]))
      for (const doc of imported) {
        const existing = merged.get(doc.id)
        if (!existing || doc.updatedAt > existing.updatedAt) {
          await saveDocument(doc)
          merged.set(doc.id, doc)
        }
      }
      const result = Array.from(merged.values()).sort(
        (a, b) => b.updatedAt - a.updatedAt,
      )
      setDocuments(result)
      if (!activeId && result.length > 0) setActiveId(result[0].id)
    },
    [activeId],
  )

  const clearAllDocuments = useCallback(async () => {
    await deleteAllDocuments()
    setDocuments([])
    setActiveId(null)
  }, [])

  const filteredDocuments = documents.filter((d) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      d.title.toLowerCase().includes(q) ||
      d.body.toLowerCase().includes(q)
    )
  })

  const starredDocuments = filteredDocuments.filter((d) => d.starred)
  const regularDocuments = filteredDocuments.filter((d) => !d.starred)

  return {
    documents,
    filteredDocuments,
    starredDocuments,
    regularDocuments,
    activeDocument,
    activeId,
    setActiveId,
    loading,
    saveStatus,
    searchQuery,
    setSearchQuery,
    externalBodyVersion,
    createDocument,
    updateDocument,
    manualSave,
    renameDocument,
    toggleStar,
    duplicateDocument,
    removeDocument,
    importDocuments,
    clearAllDocuments,
    loadDocuments,
  }
}
