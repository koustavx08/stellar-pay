import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Adds a hover lift — only for cards that are actually clickable. */
  interactive?: boolean
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  interactive = false,
}: CardProps) {
  return (
    <section className={`card ${interactive ? 'card--interactive' : ''} ${className}`.trim()}>
      {title || action ? (
        <div className="card__head">
          <div>
            {title ? <h2 className="card__title">{title}</h2> : null}
            {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}
