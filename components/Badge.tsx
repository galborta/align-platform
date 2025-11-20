import React from 'react'
import { Badge as BadgeType } from '@/lib/badges'

interface BadgeProps {
  badge: BadgeType
}

const iconMap: Record<string, string> = {
  check_circle: '✓',
  star: '★'
}

export function Badge({ badge }: BadgeProps) {
  const icon = iconMap[badge.icon] || badge.icon

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${badge.color}15`,
        color: badge.color,
        height: '24px',
        padding: '0 8px'
      }}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span className="leading-none">{badge.label}</span>
    </div>
  )
}





