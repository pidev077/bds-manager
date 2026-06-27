import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Trash2 } from 'lucide-react'
import { cartApi, customersApi, propertiesApi } from '@/lib/api'
import { formatCurrency, formatArea } from '@/lib/utils'
import type { CartItem, Customer, Property } from '@/types'
import { PROPERTY_STATUS_LABELS } from '@/types'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function Cart() {
  const [customerId, setCustomerId] = useState<number>(0)
  const [openAdd, setOpenAdd] = useState(false)
  const [propertySearch, setPropertySearch] = useState('')
  const qc = useQueryClient()

  const { data: customersData } = useQuery({
    queryKey: ['customers-select'],
    queryFn: () => customersApi.list({ per_page: 200 }),
  })
  const customers: Customer[] = customersData?.data ?? []

  const { data: cartData, isLoading } = useQuery({
    queryKey: ['cart', customerId],
    queryFn: () => cartApi.list(customerId),
    enabled: !!customerId,
  })
  const items: CartItem[] = cartData?.data ?? []

  const { data: propertiesData } = useQuery({
    queryKey: ['properties-search', propertySearch],
    queryFn: () => propertiesApi.list({ per_page: 20, search: propertySearch || undefined }),
    enabled: openAdd,
  })
  const searchResults: Property[] = propertiesData?.data ?? []

  const addMutation = useMutation({
    mutationFn: (propertyId: number) => cartApi.add({ customer_id: customerId, property_id: propertyId }),
    onSuccess: () => {
      toast.success('Đã thêm vào giỏ hàng')
      qc.invalidateQueries({ queryKey: ['cart', customerId] })
    },
    onError: () => toast.error('Có lỗi xảy ra!'),
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => cartApi.remove(id),
    onSuccess: () => {
      toast.success('Đã xóa khỏi giỏ hàng')
      qc.invalidateQueries({ queryKey: ['cart', customerId] })
    },
    onError: () => toast.error('Không thể xóa!'),
  })

  const existingPropertyIds = new Set(items.map(i => i.property_id))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Giỏ hàng cho khách</h1>
        {!!customerId && (
          <button className="btn-primary" onClick={() => { setPropertySearch(''); setOpenAdd(true) }}>
            <Plus size={16} /> Thêm căn vào giỏ
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select className="input w-64" value={customerId} onChange={e => setCustomerId(Number(e.target.value))}>
          <option value={0}>-- Chọn khách hàng --</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} {c.phone ? `- ${c.phone}` : ''}</option>)}
        </select>
      </div>

      {!customerId ? (
        <div className="bds-card"><EmptyState message="Chọn khách hàng để xem giỏ hàng" /></div>
      ) : (
        <div className="bds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Mã căn', 'Tên căn', 'Dự án', 'Trạng thái', 'Giá bán', 'DT', 'PN', 'Thao tác'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8}><LoadingState /></td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState message="Giỏ hàng trống" /></td></tr>
                ) : items.map(i => (
                  <tr key={i.id} className="table-row">
                    <td className="table-cell font-medium text-blue-600">{i.property_code || `#${i.property_id}`}</td>
                    <td className="table-cell">{i.property_title || '--'}</td>
                    <td className="table-cell text-gray-500">{i.property_project || '--'}</td>
                    <td className="table-cell text-gray-500">{i.property_status ? (PROPERTY_STATUS_LABELS[i.property_status] ?? i.property_status) : '--'}</td>
                    <td className="table-cell font-medium">{i.property_price ? formatCurrency(i.property_price) : '--'}</td>
                    <td className="table-cell">{i.property_area_gross ? formatArea(i.property_area_gross) : '--'}</td>
                    <td className="table-cell">{i.property_bedrooms || '--'}</td>
                    <td className="table-cell">
                      <button className="text-xs text-red-500 hover:underline flex items-center gap-1" onClick={() => removeMutation.mutate(i.id)}>
                        <Trash2 size={12} /> Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={openAdd} onClose={() => setOpenAdd(false)} title="Thêm căn vào giỏ hàng" size="lg">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Tìm kiếm căn theo mã, tên, dự án..." value={propertySearch} onChange={e => setPropertySearch(e.target.value)} />
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
          {searchResults.length === 0 ? (
            <EmptyState message="Không tìm thấy căn phù hợp" />
          ) : searchResults.map(p => (
            <div key={p.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{p.code || p.unit_number} - {p.title}</p>
                <p className="text-xs text-gray-500">{p.project_name} {p.price ? `· ${formatCurrency(p.price)}` : ''}</p>
              </div>
              <button
                className="btn-secondary text-xs"
                disabled={existingPropertyIds.has(p.id) || addMutation.isPending}
                onClick={() => addMutation.mutate(p.id)}
              >
                {existingPropertyIds.has(p.id) ? 'Đã thêm' : 'Thêm vào giỏ'}
              </button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
