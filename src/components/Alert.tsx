import type { ReactNode } from 'react'

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

interface AlertProps {
  tone: AlertTone
  title: string
  children?: ReactNode
  onDismiss?: () => void
}

const ICONS: Record<AlertTone, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  error: '✕',
}

export function Alert({ tone, title, children, onDismiss }: AlertProps) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="alert__icon" aria-hidden="true">
        {ICONS[tone]}
      </span>
      <div className="alert__body">
        <p className="alert__title">{title}</p>
        {children ? <div className="alert__detail">{children}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="alert__close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      ) : null}
    </div>
  )
}
