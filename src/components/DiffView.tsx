import { applyEdit } from '../utils/markdown'

interface DiffViewProps {
  originalText: string
  newText: string
  onApply: () => void
  onDiscard: () => void
}

export function DiffView({
  originalText,
  newText,
  onApply,
  onDiscard,
}: DiffViewProps) {
  return (
    <div className="my-3 rounded-lg border border-zinc-300 dark:border-zinc-600 overflow-hidden">
      <div className="max-h-48 overflow-auto text-sm font-mono">
        {originalText && (
          <div className="bg-red-50 dark:bg-red-950/40 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
            {originalText.split('\n').map((line, i) => (
              <div key={i} className="text-red-700 dark:text-red-400">
                <span className="select-none mr-2 opacity-50">−</span>
                {line || ' '}
              </div>
            ))}
          </div>
        )}
        <div className="bg-green-50 dark:bg-green-950/40 px-3 py-2">
          {newText.split('\n').map((line, i) => (
            <div key={i} className="text-green-700 dark:text-green-400">
              <span className="select-none mr-2 opacity-50">+</span>
              {line || ' '}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={onApply}
          className="px-3 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="px-3 py-1 text-xs font-medium rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  )
}

export { applyEdit }
