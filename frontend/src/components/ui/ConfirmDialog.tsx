import Modal from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message?: string
  loading?: boolean
}

export default function ConfirmDialog({ open, onClose, onConfirm, title = 'Xác nhận xóa', message = 'Bạn có chắc chắn muốn xóa mục này?', loading }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Hủy</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Đang xóa...' : 'Xóa'}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  )
}
