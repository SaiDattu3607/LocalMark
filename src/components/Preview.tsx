import { useMemo } from 'react'
import { renderMarkdown } from '../utils/markdown'
import { useSettings } from '../context/ThemeContext'

interface PreviewProps {
  body: string
  className?: string
}

export function Preview({ body, className = '' }: PreviewProps) {
  const { settings } = useSettings()

  const html = useMemo(() => renderMarkdown(body), [body])

  const fontFamily =
    settings.editorFont === 'monospace'
      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      : 'ui-sans-serif, system-ui, sans-serif'

  return (
    <div
      className={`h-full overflow-auto px-6 py-4 print-preview ${className}`}
      style={{ fontFamily }}
    >
      <article
        className="prose prose-zinc dark:prose-invert max-w-none"
        style={{ fontSize: settings.previewFontSize }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
