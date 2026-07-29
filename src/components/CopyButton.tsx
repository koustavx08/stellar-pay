import { useEffect, useState } from 'react'

interface CopyButtonProps {
  value: string
  label?: string
}

export function CopyButton({ value, label = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Clipboard access can be blocked; the value stays selectable on screen.
    }
  }

  return (
    <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
      {copied ? 'Copied' : label}
    </button>
  )
}
