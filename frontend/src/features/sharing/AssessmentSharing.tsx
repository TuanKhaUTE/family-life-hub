import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { createPortal } from 'react-dom'
import { ProfileAvatar } from '../auth/ProfileSelector'
import {
  fetchOwnerShares,
  createShare,
  revokeShare,
  type OwnerShares,
} from './share-api'
import './sharing.css'
export function AssessmentSharing({
  assessmentId,
  title,
}: {
  assessmentId: string
  title: string
}) {
  const [open, setOpen] = useState(false),
    [names, setNames] = useState<string[] | null>(null)
  return (
    <div className="assessment-sharing">
      <button aria-label={`Chia sẻ ${title}`} onClick={() => setOpen(true)}>
        Chia sẻ
      </button>
      {names !== null && (
        <p className="share-muted">
          {names.length ? 'Đã chia sẻ với ' + names.join(', ') : 'Riêng tư'}
        </p>
      )}
      {open && (
        <ShareDialog
          assessmentId={assessmentId}
          title={title}
          onClose={() => setOpen(false)}
          onChanged={setNames}
        />
      )}
    </div>
  )
}
function ShareDialog({
  assessmentId,
  title,
  onClose,
  onChanged,
}: {
  assessmentId: string
  title: string
  onClose: () => void
  onChanged: Dispatch<SetStateAction<string[] | null>>
}) {
  const [data, setData] = useState<OwnerShares | null>(null),
    [state, setState] = useState('loading'),
    [version, setVersion] = useState(0),
    [selected, setSelected] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null),
    titleId = useId(),
    groupId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector('button')?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  useEffect(() => {
    if (!ref.current?.contains(document.activeElement))
      ref.current?.querySelector('button')?.focus()
  }, [state])
  useEffect(() => {
    const c = new AbortController()
    void fetchOwnerShares(assessmentId, c.signal)
      .then((d) => {
        if (!c.signal.aborted) {
          setData(d)
          setState('ready')
          onChanged(d.shares.map((s) => s.recipient.displayName))
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setState('error')
      })
    return () => c.abort()
  }, [assessmentId, version, onChanged])
  async function mutate(id: string | null) {
    if (busy || (!id && !selected)) return
    setBusy(true)
    setError('')
    try {
      if (id) await revokeShare(id)
      else await createShare(assessmentId, selected)
      setSelected('')
      setState('loading')
      setVersion((v) => v + 1)
    } catch {
      setError('Chưa cập nhật được chia sẻ. Bạn thử lại nhé.')
    } finally {
      setBusy(false)
    }
  }
  return createPortal(
    <div
      className="share-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
          if (e.key === 'Tab') {
            const controls = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'button,input,[tabindex="0"]',
              ) ?? [],
            ).filter((node) => !node.matches(':disabled'))
            // A same-name radio group contributes one native Tab stop, not one per option.
            const radios = controls.filter(
              (node): node is HTMLInputElement =>
                node instanceof HTMLInputElement && node.type === 'radio',
            )
            const tabRadio = radios.find((node) => node.checked) ?? radios[0]
            const nodes = controls.filter(
                (node) =>
                  !radios.includes(node as HTMLInputElement) ||
                  node === tabRadio,
              ),
              first = nodes[0],
              last = nodes[nodes.length - 1]
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault()
              last?.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault()
              first?.focus()
            }
          }
        }}
      >
        <header>
          <h2 id={titleId}>Chia sẻ kết quả</h2>
          <button onClick={onClose}>Đóng chia sẻ</button>
        </header>
        <h3>{title}</h3>
        <p>
          Chỉ người bạn chọn được xem kết quả này, không gồm ghi chú, các bài
          khác hay cả góc học tập. Kết quả sẽ cập nhật theo bài bạn sửa; bạn có
          thể ngừng chia sẻ bất cứ lúc nào.
        </p>
        {state === 'loading' && (
          <p role="status">Đang xem chia sẻ của bài này…</p>
        )}
        {state === 'error' && (
          <>
            <p role="alert">Chưa mở được chia sẻ. Bạn thử lại nhé.</p>
            <button
              onClick={() => {
                setState('loading')
                setVersion((v) => v + 1)
              }}
            >
              Thử lại
            </button>
          </>
        )}
        {state === 'ready' && data && (
          <>
            {data.shares.length === 0 && (
              <p className="share-private">Riêng tư</p>
            )}
            <ul className="share-people">
              {data.shares.map((s) => (
                <li key={s.id}>
                  <ProfileAvatar profile={s.recipient} />
                  <div>
                    <p>Đã chia sẻ với {s.recipient.displayName}</p>
                    <button
                      disabled={busy}
                      aria-label={`Ngừng chia sẻ với ${s.recipient.displayName}`}
                      onClick={() => void mutate(s.id)}
                    >
                      Ngừng chia sẻ
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <fieldset disabled={busy}>
              <legend>Chia sẻ kết quả này với</legend>
              {data.recipients
                .filter(
                  (p) => !data.shares.some((s) => s.recipient.id === p.id),
                )
                .map((p) => (
                  <label className="share-recipient" key={p.id}>
                    <input
                      type="radio"
                      name={groupId}
                      value={p.id}
                      checked={selected === p.id}
                      onChange={() => setSelected(p.id)}
                    />
                    <ProfileAvatar profile={p} />
                    <span>{p.displayName}</span>
                  </label>
                ))}
              {data.recipients.every((p) =>
                data.shares.some((s) => s.recipient.id === p.id),
              ) && <p>Chưa có thêm người nhận phù hợp.</p>}
              <button
                className="share-primary"
                disabled={!selected}
                onClick={() => void mutate(null)}
              >
                Chia sẻ kết quả
              </button>
            </fieldset>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </div>,
    document.body,
  )
}
