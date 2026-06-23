import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  message?: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ message = 'Không có dữ liệu', description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Inbox size={40} strokeWidth={1.2} className="mb-3 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">{message}</p>
      {description && <p className="text-xs mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
