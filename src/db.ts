import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface Document {
  id: string
  title: string
  body: string
  createdAt: number
  updatedAt: number
  starred: boolean
}

export interface SettingEntry {
  key: string
  value: unknown
}

export interface AppState {
  trialStartedAt: number
  licensed: boolean
  licenseKey: string | null
  activatedAt: number | null
  shownExpiryWarning: boolean
}

export const TRIAL_LENGTH_MS = 7 * 24 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

interface LocalMarkDB extends DBSchema {
  documents: {
    key: string
    value: Document
    indexes: { 'by-updatedAt': number; 'by-starred': number }
  }
  settings: {
    key: string
    value: SettingEntry
  }
}

const DB_NAME = 'localmark-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<LocalMarkDB>> | null = null

function getDB(): Promise<IDBPDatabase<LocalMarkDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LocalMarkDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id' })
        docStore.createIndex('by-updatedAt', 'updatedAt')
        docStore.createIndex('by-starred', 'starred')
        db.createObjectStore('settings', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

export async function getAllDocuments(): Promise<Document[]> {
  const db = await getDB()
  const docs = await db.getAll('documents')
  return docs.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getDocument(id: string): Promise<Document | undefined> {
  const db = await getDB()
  return db.get('documents', id)
}

export async function saveDocument(doc: Document): Promise<void> {
  const db = await getDB()
  await db.put('documents', doc)
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('documents', id)
}

export async function deleteAllDocuments(): Promise<void> {
  const db = await getDB()
  const docs = await db.getAll('documents')
  const tx = db.transaction('documents', 'readwrite')
  await Promise.all([...docs.map((d) => tx.store.delete(d.id)), tx.done])
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB()
  const entry = await db.get('settings', key)
  return entry?.value as T | undefined
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key, value })
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const db = await getDB()
  const entries = await db.getAll('settings')
  return Object.fromEntries(entries.map((e) => [e.key, e.value]))
}

export function createInitialAppState(now = Date.now()): AppState {
  return {
    trialStartedAt: now,
    licensed: false,
    licenseKey: null,
    activatedAt: null,
    shownExpiryWarning: false,
  }
}

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AppState>
  return (
    typeof candidate.trialStartedAt === 'number' &&
    typeof candidate.licensed === 'boolean' &&
    (typeof candidate.licenseKey === 'string' || candidate.licenseKey === null) &&
    (typeof candidate.activatedAt === 'number' || candidate.activatedAt === null) &&
    typeof candidate.shownExpiryWarning === 'boolean'
  )
}

export async function getOrCreateAppState(): Promise<AppState> {
  const existing = await getSetting<unknown>('appState')
  if (isAppState(existing)) return existing

  const appState = createInitialAppState()
  await setSetting('appState', appState)
  return appState
}

export async function updateAppState(
  updates: Partial<AppState>,
): Promise<AppState> {
  const current = await getOrCreateAppState()
  const next: AppState = { ...current, ...updates }
  await setSetting('appState', next)
  return next
}
