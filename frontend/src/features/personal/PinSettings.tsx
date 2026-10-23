import { useEffect, useRef, useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { changePin, resetMembers, resetPin, profileError } from './profile-api'
import { AppIcon } from '../../ui/AppIcon'
export function PinSettings({
  admin = false,
  onSessionEnded,
}: {
  admin?: boolean
  onSessionEnded?: () => void
}) {
  const [open, setOpen] = useState(false),
    [notice, setNotice] = useState<string | null>(null),
    trigger = useRef<HTMLButtonElement>(null)
  function close() {
    setOpen(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  return (
    <section className="expense-card pin-settings">
      <h2><span className="icon-well"><AppIcon name="personal" size={18} /></span>{admin ? 'Quản lý mã PIN gia đình' : 'Bảo mật'}</h2>
      <p>
        {admin
          ? 'Chỉ để khôi phục đăng nhập. Quyền xem dữ liệu riêng tư không thay đổi.'
          : 'Sau khi đổi PIN, tất cả phiên của bạn sẽ kết thúc, kể cả phiên này. Bạn cần đăng nhập lại bằng mã mới.'}
      </p>
      {notice && <p role="status">{notice}</p>}
      <button
        ref={trigger}
        hidden={open}
        onClick={() => {
          setNotice(null)
          setOpen(true)
        }}
      >
        {admin ? 'Quản lý mã PIN gia đình' : 'Đổi mã PIN'}
      </button>
      {open && (
        <PinForm
          admin={admin}
          onCancel={close}
          onSuccess={(name) => {
            close()
            setNotice(
              admin
                ? `Đã đặt lại mã PIN cho ${name}. Các phiên cũ đã kết thúc.`
                : 'Đã đổi mã PIN. Vui lòng đăng nhập lại bằng mã mới.',
            )
            if (!admin) onSessionEnded?.()
          }}
        />
      )}
    </section>
  )
}
function PinForm({
  admin,
  onCancel,
  onSuccess,
}: {
  admin: boolean
  onCancel: () => void
  onSuccess: (name: string) => void
}) {
  const [currentPin, setCurrent] = useState(''),
    [newPin, setNew] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [members, setMembers] = useState<FamilyProfile[]>([]),
    [target, setTarget] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(admin),
    [failed, setFailed] = useState(false),
    [version, setVersion] = useState(0)
  const name = members.find((m) => m.id === target)?.displayName ?? ''
  useEffect(() => {
    if (!admin) return
    const c = new AbortController()
    void resetMembers(c.signal)
      .then((m) => {
        if (!c.signal.aborted) {
          setMembers(m)
          setLoading(false)
          setFailed(false)
        }
      })
      .catch(() => {
        if (!c.signal.aborted) {
          setLoading(false)
          setFailed(true)
        }
      })
    return () => c.abort()
  }, [admin, version])
  async function submit(e: React.SubmitEvent) {
    e.preventDefault()
    if (pending) return
    setError(null)
    if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin)) {
      setError('Mã PIN cần đúng 6 chữ số từ 0 đến 9.')
      return
    }
    if (newPin !== confirmation) {
      setError('Hai mã PIN mới chưa khớp. Bạn kiểm tra lại nhé.')
      return
    }
    if (admin && (!target || !confirmed)) return
    setPending(true)
    try {
      const input = { currentPin, newPin, confirmation }
      if (admin) await resetPin(target, { ...input, confirmReset: true })
      else await changePin(input)
      onSuccess(name)
    } catch (e) {
      setError(profileError(e))
    } finally {
      setCurrent('')
      setNew('')
      setConfirmation('')
      setConfirmed(false)
      setPending(false)
    }
  }
  return (
    <form onSubmit={submit} className="personal-pin-form">
      {admin && (
        <>
          {loading && <p role="status">Đang tải thành viên…</p>}
          {failed && (
            <>
              <p>Chưa tải được danh sách thành viên.</p>
              <button
                type="button"
                onClick={() => {
                  setFailed(false)
                  setLoading(true)
                  setVersion((v) => v + 1)
                }}
              >
                Thử tải lại thành viên
              </button>
            </>
          )}
          <label>
            Thành viên cần đặt lại PIN
            <select
              autoFocus
              disabled={pending}
              value={target}
              onChange={(e) => {
                setTarget(e.target.value)
                setConfirmed(false)
                setCurrent('')
                setNew('')
                setConfirmation('')
              }}
              required
            >
              <option value="">Chọn thành viên</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
          {!loading && !failed && members.length === 0 && (
            <p>Không có thành viên khác đang hoạt động.</p>
          )}
        </>
      )}
      <label>
        {admin ? 'Mã PIN hiện tại của bạn' : 'Mã PIN hiện tại'}
        <input
          autoFocus={!admin}
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={6}
          value={currentPin}
          disabled={pending}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </label>
      <label>
        Mã PIN mới
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={6}
          value={newPin}
          disabled={pending}
          onChange={(e) => setNew(e.target.value)}
          required
        />
      </label>
      <label>
        Xác nhận mã PIN mới
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={6}
          value={confirmation}
          disabled={pending}
          onChange={(e) => setConfirmation(e.target.value)}
          required
        />
      </label>
      {admin && (
        <label className="reset-confirmation">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={!target || pending}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Tôi xác nhận đặt lại PIN cho {name || 'thành viên đã chọn'} và kết
          thúc tất cả phiên của người này.
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="personal-actions">
        <button
          type="submit"
          disabled={
            pending || (admin && (!target || !confirmed || loading || failed))
          }
        >
          {pending ? 'Đang lưu…' : admin ? 'Đặt lại mã PIN' : 'Lưu mã PIN mới'}
        </button>
        <button type="button" disabled={pending} onClick={onCancel}>
          Hủy
        </button>
      </div>
    </form>
  )
}
