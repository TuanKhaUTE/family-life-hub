import { useEffect, useRef, useState } from 'react'
import {
  fetchWellness,
  deleteWeight,
  wellnessError,
  type WellnessWorkspace,
  type WeightLog,
} from './wellness-api'
import { WellnessForm } from './WellnessForm'
import { WellnessSummary } from './WellnessSummary'
import { wellnessNumber, wellnessDate } from './wellness-display'
import { WellnessIllustration } from '../../ui/Illustration'
import './wellness.css'

export function WellnessSection() {
  const [data, setData] = useState<WellnessWorkspace | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState<{
    mode: 'profile' | 'weight'
    record: WeightLog | null
  } | null>(null)
  const [remove, setRemove] = useState<WeightLog | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const removeTrigger = useRef<HTMLButtonElement | null>(null)
  const removeDialog = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetchWellness(controller.signal)
      .then((view) => {
        if (!controller.signal.aborted) {
          setData(view)
          setState('ready')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error')
      })
    return () => controller.abort()
  }, [version])
  function reload() {
    setState('loading')
    setVersion((v) => v + 1)
  }
  useEffect(() => {
    if (!remove) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    removeDialog.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRemove(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
      removeTrigger.current?.focus()
    }
  }, [remove])
  function open(mode: 'profile' | 'weight', record: WeightLog | null = null) {
    setForm({ mode, record })
    setMessage(null)
    setError(null)
  }
  function saved() {
    setForm(null)
    setMessage('Đã lưu vào góc thể trạng của bạn.')
    reload()
  }
  function weightEditor(log: WeightLog) {
    if (form?.mode !== 'weight' || !form.record || form.record.id !== log.id)
      return null
    return (
      <WellnessForm
        key={`weight:${form.record.id}`}
        mode="weight"
        record={form.record}
        data={data!}
        onClose={() => {
          setForm(null)
          setError(null)
        }}
        onSaved={saved}
      />
    )
  }
  async function confirmDelete() {
    if (!remove || pending) return
    setPending(true)
    setError(null)
    try {
      await deleteWeight(remove.id)
      setRemove(null)
      setMessage('Đã xóa lần cân bạn chọn.')
      reload()
    } catch (error) {
      setError(wellnessError(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <section className="wellness-section" aria-label="Thể trạng">
      <header className="wellness-heading">
        <div>
          <p className="eyebrow">Góc riêng cho mình 🌱</p>
          <h3>Thể trạng</h3>
        </div>
        <WellnessIllustration />
      </header>
      <p>
        Ghi lại khi bạn muốn, để nhìn lại thay đổi của chính mình. Chỉ bạn xem
        được.
      </p>
      {state === 'loading' && (
        <p role="status" aria-label="Tải thể trạng">
          Đang mở góc thể trạng…
        </p>
      )}
      {state === 'error' && (
        <div>
          <p role="alert">Chưa tải được thể trạng. Bạn thử lại nhé.</p>
          <button onClick={reload}>Thử lại thể trạng</button>
        </div>
      )}
      {state === 'ready' && data && (
        <>
          <div className="wellness-actions">
            <button
              className={form?.mode === 'weight' ? 'wellness-primary' : undefined}
              aria-pressed={form?.mode === 'weight'}
              onClick={() => open('weight')}
            >
              Ghi cân nặng
            </button>
            <button
              className={form?.mode === 'profile' ? 'wellness-primary' : undefined}
              aria-pressed={form?.mode === 'profile'}
              onClick={() => open('profile')}
            >
              Cập nhật thông tin
            </button>
          </div>
          {message && (
            <p role="status" className="wellness-message">
              {message}
            </p>
          )}
          {error && !remove && <p role="alert">{error}</p>}
          {form && (form.mode === 'profile' || form.record === null) && (
            <WellnessForm
              key={`${form.mode}:${form.record?.id ?? 'new'}`}
              {...form}
              data={data}
              onClose={() => {
                setForm(null)
                setError(null)
              }}
              onSaved={saved}
            />
          )}
          {remove && (
            <div
              className="wellness-delete-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setRemove(null)
              }}
            >
              <section
                ref={removeDialog}
                className="wellness-delete-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="wellness-delete-title"
                tabIndex={-1}
              >
                <h4 id="wellness-delete-title">Xóa lần cân này?</h4>
                <p>
                  Bạn có chắc muốn xóa lần cân ngày {wellnessDate(remove.loggedDate)}?{' '}
                  Thao tác này không thể hoàn tác.
                </p>
                {error && <p role="alert">{error}</p>}
                <div className="wellness-actions wellness-delete-actions">
                  <button type="button" disabled={pending} onClick={() => setRemove(null)}>
                    Giữ lại
                  </button>
                  <button
                    type="button"
                    className="wellness-danger"
                    disabled={pending}
                    onClick={() => void confirmDelete()}
                  >
                    Xóa lần cân
                  </button>
                </div>
              </section>
            </div>
          )}
          <WellnessSummary data={data} />
          <section aria-label="Lịch sử cân nặng" className="wellness-history">
            <h4>Lần cân gần đây</h4>
            {!data.logs.length ? (
              <p>Chưa có lần cân nào</p>
            ) : (
              <ol>
                {(expanded ? data.logs : data.logs.slice(0, 3)).map((log) => (
                  <li key={log.id}>
                    <div className="wellness-observation">
                      <time dateTime={log.loggedDate}>
                        {wellnessDate(log.loggedDate)}
                      </time>
                      <strong>{wellnessNumber(log.weightKg)} kg</strong>
                    </div>
                    {log.note && <p className="wellness-note">{log.note}</p>}
                    <div className="wellness-actions">
                      <button
                        aria-label={`Sửa lần cân ${log.loggedDate}`}
                        onClick={() => open('weight', log)}
                      >
                        Sửa
                      </button>
                      <button
                        aria-label={`Xóa lần cân ${log.loggedDate}`}
                        onClick={(event) => {
                          removeTrigger.current = event.currentTarget
                          setRemove(log)
                          setError(null)
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                    {weightEditor(log)}
                  </li>
                ))}
              </ol>
            )}
            {data.logs.length > 3 && (
              <button onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Thu gọn lần cân' : 'Xem thêm lần cân'}
              </button>
            )}
            <p className="wellness-hint">
              Tối đa 14 lần cân gần nhất ở đây. Xu hướng dùng mọi lần cân thực
              có trong khoảng 7/30 ngày.
            </p>
          </section>
        </>
      )}
    </section>
  )
}
