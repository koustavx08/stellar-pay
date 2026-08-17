import type { ReactNode } from 'react'

/** Placeholder block sized in `ch` so it roughly matches the text it stands in for. */
export function Skeleton({ width = '8ch', height = '1em' }: { width?: string; height?: string }) {
  return <span className="skeleton" style={{ width, height }} aria-hidden="true" />
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-rows" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-row">
          <span className="skeleton skeleton--circle" />
          <span className="skeleton" style={{ width: '40%' }} />
          <span className="skeleton" style={{ width: '20%', marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  )
}

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon = '◎', title, description, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty__title">{title}</p>
      {description ? <p className="empty__description">{description}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  message: string
  action?: ReactNode
}

export function ErrorState({ title = 'Something went wrong', message, action }: ErrorStateProps) {
  return (
    <div className="empty empty--error" role="alert">
      <span className="empty__icon" aria-hidden="true">
        ✕
      </span>
      <p className="empty__title">{title}</p>
      <p className="empty__description">{message}</p>
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  )
}
