import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
dayjs.locale('vi')

export const formatDate = (date: string | null | undefined, fmt = 'DD/MM/YYYY'): string => {
  if (!date) return '--'
  return dayjs(date).format(fmt)
}

export const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return '--'
  return dayjs(date).format('HH:mm DD/MM/YYYY')
}

export const formatTime = (date: string | null | undefined): string => {
  if (!date) return '--'
  return dayjs(date).format('HH:mm:ss')
}

export const formatRelativeTime = (date: string): string => dayjs(date).fromNow()

export const formatCurrency = (value: number | null | undefined): string => {
  if (!value) return '--'
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '') + ' tỷ'
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(0) + ' triệu'
  return value.toLocaleString('vi-VN') + ' đ'
}

export const formatArea = (area: number | null | undefined): string => {
  if (!area) return '--'
  return area + ' m²'
}

export const formatNumber = (n: number | null | undefined): string => {
  if (n == null) return '0'
  return n.toLocaleString('vi-VN')
}

export const clsx = (...classes: (string | undefined | null | false)[]): string =>
  classes.filter(Boolean).join(' ')

export const getInitials = (name: string): string => {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
}

export const getAvatarColor = (name: string): string => {
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-orange-500', 'bg-teal-500', 'bg-pink-500', 'bg-indigo-500']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export const debounce = <T extends (...args: unknown[]) => unknown>(fn: T, delay = 300) => {
  let t: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

export const truncate = (str: string, len = 50): string =>
  str.length > len ? str.slice(0, len) + '...' : str
