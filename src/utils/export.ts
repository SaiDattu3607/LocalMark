import type { Document } from '../db'

export function downloadMarkdown(doc: Document): void {
  const blob = new Blob([doc.body], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(doc.title)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyMarkdown(body: string): Promise<void> {
  await navigator.clipboard.writeText(body)
}

export function exportAllDocuments(docs: Document[]): void {
  const json = JSON.stringify(docs, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `localmark-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAllData(
  docs: Document[],
  settings: Record<string, unknown>,
): void {
  const payload = { documents: docs, settings, exportedAt: Date.now() }
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `localmark-full-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function mergeDocuments(
  existing: Document[],
  imported: Document[],
): Document[] {
  const map = new Map(existing.map((d) => [d.id, d]))

  for (const doc of imported) {
    const current = map.get(doc.id)
    if (!current || doc.updatedAt > current.updatedAt) {
      map.set(doc.id, doc)
    }
  }

  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100) || 'document'
}
