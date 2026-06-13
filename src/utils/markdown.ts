import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function renderMarkdown(markdown: string): string {
  const raw = marked.parse(markdown, { async: false }) as string
  return DOMPurify.sanitize(raw)
}

export function getPreviewLine(body: string): string {
  const line = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  if (!line) return 'Empty document'
  const cleaned = line.replace(/^#+\s*/, '').replace(/[*_`>#-]/g, '').trim()
  return cleaned.slice(0, 80) || 'Empty document'
}

export function extractTitleFromBody(body: string, fallback = 'Untitled'): string {
  const match = body.match(/^#\s+(.+)$/m)
  if (match) return match[1].trim().slice(0, 100)
  const firstLine = body.split('\n').find((l) => l.trim())
  if (firstLine) return firstLine.trim().slice(0, 100)
  return fallback
}

export const DEFAULT_SYSTEM_PROMPT = `You are a writing assistant embedded in a markdown editor. The user will share their document and ask for changes. When making edits, wrap your suggested replacement text in <edit> tags like this:
<edit>new text here</edit>
Always explain what you changed before the edit block.`

export interface ParsedEdit {
  newText: string
  originalText: string
  explanation: string
}

export function parseEditBlocks(
  response: string,
  documentBody: string,
): ParsedEdit[] {
  const edits: ParsedEdit[] = []
  const regex = /<edit>([\s\S]*?)<\/edit>/gi
  let match: RegExpExecArray | null
  let lastIndex = 0

  while ((match = regex.exec(response)) !== null) {
    const newText = match[1].trim()
    const explanation = response.slice(lastIndex, match.index).trim()
    lastIndex = match.index + match[0].length

    const quoted =
      explanation.match(/["']([^"']{10,})["']/)?.[1] ??
      explanation.match(/`([^`]{10,})`/)?.[1]

    let originalText = quoted ?? findBestMatch(documentBody, newText, explanation)
    if (!originalText) originalText = documentBody

    edits.push({ newText, originalText, explanation })
  }

  return edits
}

function findBestMatch(
  documentBody: string,
  newText: string,
  explanation: string,
): string {
  const paragraphs = documentBody.split(/\n\n+/).filter((p) => p.trim())
  const explanationWords = new Set(
    explanation.toLowerCase().split(/\W+/).filter((w) => w.length > 3),
  )

  let best = ''
  let bestScore = 0

  for (const para of paragraphs) {
    const words = para.toLowerCase().split(/\W+/)
    const overlap = words.filter((w) => explanationWords.has(w)).length
    if (overlap > bestScore) {
      bestScore = overlap
      best = para
    }
  }

  if (bestScore > 0) return best

  if (newText.length > documentBody.length * 0.5) return documentBody

  return paragraphs[0] ?? documentBody
}

export function applyEdit(
  documentBody: string,
  originalText: string,
  newText: string,
): string {
  const idx = documentBody.indexOf(originalText)
  if (idx !== -1) {
    return (
      documentBody.slice(0, idx) +
      newText +
      documentBody.slice(idx + originalText.length)
    )
  }
  return documentBody + '\n\n' + newText
}
