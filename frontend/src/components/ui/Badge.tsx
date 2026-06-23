type Color = 'green' | 'red' | 'blue' | 'yellow' | 'gray' | 'purple' | 'orange'

interface BadgeProps {
  label: string
  color?: Color
  dot?: boolean
}

const COLOR_MAP: Record<Color, string> = {
  green:  'badge-green',
  red:    'badge-red',
  blue:   'badge-blue',
  yellow: 'badge-yellow',
  gray:   'badge-gray',
  purple: 'badge-purple',
  orange: 'badge-orange',
}

export default function Badge({ label, color = 'gray', dot = false }: BadgeProps) {
  return (
    <span className={COLOR_MAP[color]}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 inline-block" />}
      {label}
    </span>
  )
}
