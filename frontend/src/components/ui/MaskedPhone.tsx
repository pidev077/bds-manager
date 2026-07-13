import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface MaskedPhoneProps {
  phone: string
  className?: string
}

// Ẩn SĐT bằng dấu * (chỉ giữ 3 số cuối), bấm vào để hiện/ẩn số đầy đủ.
export default function MaskedPhone({ phone, className = '' }: MaskedPhoneProps) {
  const [revealed, setRevealed] = useState(false)

  if (!phone) return <>--</>

  const masked = phone.length > 3 ? '*'.repeat(phone.length - 3) + phone.slice(-3) : phone

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 hover:text-blue-600 transition-colors ${className}`}
      onClick={e => { e.stopPropagation(); setRevealed(r => !r) }}
      title={revealed ? 'Ẩn số điện thoại' : 'Bấm để xem số điện thoại'}
    >
      <span className="tabular-nums">{revealed ? phone : masked}</span>
      {revealed ? <EyeOff size={11} className="shrink-0" /> : <Eye size={11} className="shrink-0" />}
    </button>
  )
}
