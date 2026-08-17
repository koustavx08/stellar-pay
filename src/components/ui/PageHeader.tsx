import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </div>
  )
}

/** Coloured pill used for transaction and account status. */
export function StatusBadge({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'error' | 'neutral'
  children: ReactNode
}) {
  return <span className={`status status--${tone}`}>{children}</span>
}
