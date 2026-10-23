import { useEffect, useRef, useState, type FormEvent } from 'react'

import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import {
  BreakfastClosedApiError,
  confirmBreakfastPurchase,
  fetchBreakfastCatalog,
  fetchBreakfastDay,
  saveBreakfastResponse,
  type BreakfastCatalogItem,
  type BreakfastDay,
  type BreakfastDayResponse,
  type BreakfastSubmission,
  type BreakfastPurchase,
} from './breakfast-api'
import './breakfast.css'
import { breakfastLifecycle, relevantBreakfastDate } from '../meals/family-time'
import { useFamilyClock } from '../meals/use-family-clock'
import { FoodIllustration } from '../../ui/Illustration'

interface BreakfastSectionProps {
  profile: FamilyProfile
}

type Draft =
  | { state: 'SELECTED'; catalogItemId: string }
  | { state: 'CUSTOM'; customText: string }
  | { state: 'NOT_EATING' }
  | { state: 'NO_RESPONSE' }

export function BreakfastSection({ profile }: BreakfastSectionProps) {
  const now = useFamilyClock(),
    cycle = relevantBreakfastDate(now)
  const [day, setDay] = useState<BreakfastDay | null>(null)
  const [catalog, setCatalog] = useState<BreakfastCatalogItem[]>([])
  const [draft, setDraft] = useState<Draft>({ state: 'NO_RESPONSE' })
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const submittingRef = useRef(false)
  const isParent = profile.role === 'PARENT'
  useEffect(() => {
    const refresh = () => setReloadKey((v) => v + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  useEffect(() => {
    let active = true

    void Promise.all([
      fetchBreakfastDay(),
      isParent ? Promise.resolve([]) : fetchBreakfastCatalog(),
    ])
      .then(([loadedDay, loadedCatalog]) => {
        if (!active) return
        setDay(loadedDay)
        setCatalog(loadedCatalog)
        const ownResponse = loadedDay.responses.find(
          (item) => item.member.id === profile.id,
        )
        setDraft(toDraft(ownResponse))
        setIsEditing(
          ownResponse === undefined || ownResponse.state === 'NO_RESPONSE',
        )
        setLoadState('ready')
      })
      .catch(() => {
        if (active) setLoadState('error')
      })

    return () => {
      active = false
    }
  }, [isParent, profile.id, reloadKey, cycle])

  if (loadState === 'loading') {
    return (
      <section className="breakfast-card" aria-labelledby="breakfast-title">
        <BreakfastHeader />
        <p className="breakfast-message" role="status">
          Đang dọn bàn ăn sáng…
        </p>
      </section>
    )
  }

  if (loadState === 'error' || day === null) {
    return (
      <section className="breakfast-card" aria-labelledby="breakfast-title">
        <BreakfastHeader />
        <div className="breakfast-message breakfast-message--error">
          <p>Hiện chưa thể tải thông tin bữa sáng.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setLoadState('loading')
              setSaveError(null)
              setReloadKey((value) => value + 1)
            }}
          >
            Thử tải lại bữa sáng
          </button>
        </div>
      </section>
    )
  }

  if (isParent) {
    return (
      <ParentBreakfastView
        key={day.date}
        day={{
          ...day,
          isOpen:
            day.isOpen &&
            breakfastLifecycle(day.date, now).isOpen &&
            day.purchase === null,
        }}
        onPurchase={(purchase) =>
          setDay((current) =>
            current === null ? current : { ...current, purchase },
          )
        }
      />
    )
  }

  const ownResponse =
    day.responses.find((item) => item.member.id === profile.id) ?? null
  const lifecycle = breakfastLifecycle(day.date, now)
  const canEdit = day.isOpen && lifecycle.isOpen && day.purchase === null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current || day === null || !canEdit) return
    const submission = toSubmission(draft)
    if (submission === null) return

    submittingRef.current = true
    setIsSaving(true)
    setSaveError(null)
    try {
      const saved = await saveBreakfastResponse(day.date, submission)
      setDay((current) =>
        current === null
          ? current
          : {
              ...current,
              responses: current.responses.map((item) =>
                item.member.id === saved.member.id ? saved : item,
              ),
            },
      )
      setDraft(toDraft(saved))
      setIsEditing(false)
    } catch (error) {
      if (error instanceof BreakfastClosedApiError) {
        setDay((current) =>
          current === null ? current : { ...current, isOpen: false },
        )
      } else {
        setSaveError('Chưa thể lưu lựa chọn bữa sáng. Vui lòng thử lại.')
      }
    } finally {
      submittingRef.current = false
      setIsSaving(false)
    }
  }

  if (day.purchase)
    return (
      <section className="breakfast-card" aria-labelledby="breakfast-title">
        <BreakfastHeader day={day} />
        <MemberPurchaseBanner
          purchase={day.purchase}
          food={
            ownResponse && ownResponse.state !== 'NO_RESPONSE'
              ? describeResponse(ownResponse)
              : null
          }
        />
      </section>
    )

  return (
    <section className="breakfast-card" aria-labelledby="breakfast-title">
      <BreakfastHeader day={day} />

      {!canEdit ? (
        <>
          <SavedChoiceCard response={ownResponse} />
          <div className="breakfast-closed" role="status">
            <strong>
              {lifecycle.phase === 'UPCOMING'
                ? 'Bữa sáng ngày mai chưa mở'
                : 'Đã hết thời gian chọn bữa sáng'}
            </strong>
            <span>
              {lifecycle.phase === 'UPCOMING'
                ? 'Mở lúc 18:00 theo giờ gia đình.'
                : ownResponse?.state === 'NO_RESPONSE'
                  ? 'Mẹ mua gì mình ăn đó nhé.'
                  : 'Lựa chọn đã chốt lúc 01:00.'}
            </span>
            {lifecycle.phase === 'CLOSED' && (
              <span>Bữa sáng ngày mai chưa mở · mở lúc 18:00.</span>
            )}
          </div>
        </>
      ) : ownResponse?.state !== 'NO_RESPONSE' && !isEditing ? (
        <SavedChoiceCard
          response={ownResponse}
          onChange={() => setIsEditing(true)}
        />
      ) : (
        <form className="breakfast-form" onSubmit={handleSubmit}>
          <p>Chọn bữa sáng trước 01:00</p>
          <fieldset>
            <legend>Bạn muốn ăn gì?</legend>
            <div className="breakfast-options">
              {catalog.map((item) => (
                <ChoiceCard
                  key={item.id}
                  label={item.name}
                  checked={
                    draft.state === 'SELECTED' &&
                    draft.catalogItemId === item.id
                  }
                  onSelect={() =>
                    setDraft({ state: 'SELECTED', catalogItemId: item.id })
                  }
                />
              ))}
              <ChoiceCard
                label="Món khác / tự nhập"
                checked={draft.state === 'CUSTOM'}
                tone="peach"
                onSelect={() =>
                  setDraft({
                    state: 'CUSTOM',
                    customText:
                      draft.state === 'CUSTOM' ? draft.customText : '',
                  })
                }
              />
              <ChoiceCard
                label="Không ăn"
                checked={draft.state === 'NOT_EATING'}
                tone="quiet"
                onSelect={() => setDraft({ state: 'NOT_EATING' })}
              />
            </div>
          </fieldset>

          {draft.state === 'CUSTOM' && (
            <label className="custom-choice">
              <span>Món ăn sáng của bạn</span>
              <input
                value={draft.customText}
                maxLength={120}
                autoComplete="off"
                placeholder="Ví dụ: Cháo gà"
                onChange={(event) =>
                  setDraft({ state: 'CUSTOM', customText: event.target.value })
                }
              />
            </label>
          )}

          {saveError && (
            <p className="breakfast-save-error" role="alert">
              {saveError}
            </p>
          )}

          <button
            className="primary-button breakfast-save"
            type="submit"
            disabled={!canSubmit(draft) || isSaving}
          >
            {isSaving
              ? 'Đang lưu…'
              : ownResponse?.state === 'NO_RESPONSE' || ownResponse === null
                ? 'Lưu lựa chọn bữa sáng'
                : 'Cập nhật lựa chọn bữa sáng'}
          </button>
        </form>
      )}
    </section>
  )
}

function BreakfastHeader({ day }: { day?: BreakfastDay }) {
  return (
    <header className="breakfast-heading">
      <div>
        <p className="eyebrow">Cả nhà ăn sáng nhé</p>
        <h2 id="breakfast-title">Bữa sáng tiếp theo</h2>
      </div>
      <div className="breakfast-heading-art">
        <FoodIllustration />
        <span className="breakfast-date">
          {day ? formatFamilyDate(day.date, day.timeZone) : 'Ngày tiếp theo'}
        </span>
      </div>
    </header>
  )
}

function ChoiceCard({
  label,
  checked,
  onSelect,
  tone = 'sage',
}: {
  label: string
  checked: boolean
  onSelect: () => void
  tone?: 'sage' | 'peach' | 'quiet'
}) {
  return (
    <label
      className={`breakfast-option breakfast-option--${tone}${checked ? ' is-selected' : ''}`}
    >
      <input
        type="radio"
        name="breakfast-choice"
        checked={checked}
        onChange={onSelect}
      />
      <span className="breakfast-option-art" aria-hidden="true">
        <FoodIllustration variant={tone === 'quiet' ? 'final' : tone === 'peach' ? 'dinner' : 'breakfast'} />
      </span>
      <span>{label}</span>
      <i aria-hidden="true">{checked ? '✓' : ''}</i>
    </label>
  )
}

function SavedChoiceCard({
  response,
  onChange,
}: {
  response: BreakfastDayResponse | null
  onChange?: () => void
}) {
  const hasResponse = response !== null && response.state !== 'NO_RESPONSE'
  return (
    <div
      className={`saved-choice${hasResponse ? ' is-saved' : ''}`}
      aria-live="polite"
    >
      <div>
        <strong>{hasResponse ? 'Đã lưu bữa sáng' : 'Chưa trả lời'}</strong>
        <span>
          {hasResponse
            ? describeResponse(response)
            : 'Chưa lưu lựa chọn bữa sáng.'}
        </span>
      </div>
      {hasResponse && onChange && (
        <button
          className="secondary-button saved-choice-change"
          type="button"
          onClick={onChange}
        >
          Đổi lựa chọn
        </button>
      )}
    </div>
  )
}

function MemberPurchaseBanner({
  purchase,
  food,
}: {
  purchase: BreakfastPurchase
  food?: string | null
}) {
  return (
    <aside
      className="breakfast-purchased-banner"
      aria-label="Đã xác nhận mua bữa sáng"
    >
      <strong>Mẹ đã mua bữa sáng ✓</strong>
      {food && <p>{food}</p>}
      {purchase.message && <p>{purchase.message}</p>}
    </aside>
  )
}

function ParentBreakfastView({
  day,
  onPurchase,
}: {
  day: BreakfastDay
  onPurchase: (purchase: BreakfastPurchase) => void
}) {
  const [message, setMessage] = useState(day.purchase?.message ?? '')
  const [isEditingMessage, setIsEditingMessage] = useState(
    day.purchase === null,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const purchase = await confirmBreakfastPurchase(
        day.date,
        message.trim() || null,
      )
      onPurchase(purchase)
      setMessage(purchase.message ?? '')
      setIsEditingMessage(false)
    } catch {
      setError('Chưa thể xác nhận mua bữa sáng. Vui lòng thử lại.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="breakfast-card" aria-labelledby="breakfast-title">
      <BreakfastHeader day={day} />
      {day.purchase && !isEditingMessage ? (
        <>
          <MemberPurchaseBanner purchase={day.purchase} />
          <p>{formatPurchaseTime(day.purchase.purchasedAt, day.timeZone)}</p>
          <button
            className="secondary-button"
            onClick={() => setIsEditingMessage(true)}
          >
            Sửa lời nhắn
          </button>
        </>
      ) : (
        <>
          <p className="breakfast-parent-copy">
            {day.isOpen
              ? 'Cả nhà đang chọn bữa sáng · chốt lúc 01:00.'
              : 'Phản hồi bữa sáng đã chốt · không thể đổi sau 01:00.'}
          </p>
          <ul
            className="breakfast-status-list"
            aria-label="Lựa chọn bữa sáng của cả nhà"
          >
            {day.responses.map((response) => (
              <li key={response.member.id}>
                <ProfileAvatar profile={response.member} />
                <div>
                  <strong>{response.member.displayName}</strong>
                  <span className={`status-${response.state.toLowerCase()}`}>
                    {describeParentResponse(response)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {!day.isOpen && (
            <div className="breakfast-purchase-section">
              <form
                className="breakfast-purchase-form"
                onSubmit={handlePurchase}
              >
                <div className="breakfast-note-field">
                  <label>
                    <span>Lời nhắn cho cả nhà</span>
                    <textarea
                      value={message}
                      maxLength={300}
                      rows={2}
                      placeholder="Ví dụ: Nước cam trong tủ lạnh nha"
                      onChange={(event) => setMessage(event.target.value)}
                    />
                  </label>
                  <small>Không bắt buộc · có thể thêm sau</small>
                </div>
                {error && (
                  <p className="breakfast-save-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving
                    ? 'Đang lưu…'
                    : day.purchase
                      ? 'Cập nhật lời nhắn'
                      : 'Xác nhận đã mua'}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function toDraft(response?: BreakfastDayResponse): Draft {
  if (response?.state === 'SELECTED' && response.catalogItem) {
    return { state: 'SELECTED', catalogItemId: response.catalogItem.id }
  }
  if (response?.state === 'CUSTOM') {
    return { state: 'CUSTOM', customText: response.customText ?? '' }
  }
  if (response?.state === 'NOT_EATING') return { state: 'NOT_EATING' }
  return { state: 'NO_RESPONSE' }
}

function toSubmission(draft: Draft): BreakfastSubmission | null {
  if (draft.state === 'SELECTED') return draft
  if (draft.state === 'NOT_EATING') return draft
  if (draft.state === 'CUSTOM') {
    const customText = draft.customText.trim()
    return customText ? { state: 'CUSTOM', customText } : null
  }
  return null
}

function canSubmit(draft: Draft): boolean {
  return (
    draft.state === 'SELECTED' ||
    draft.state === 'NOT_EATING' ||
    (draft.state === 'CUSTOM' && draft.customText.trim().length > 0)
  )
}

function describeResponse(response: BreakfastDayResponse): string {
  if (response.state === 'SELECTED')
    return response.catalogItem?.name ?? 'Món đã chọn'
  if (response.state === 'CUSTOM') return response.customText ?? 'Món tự chọn'
  if (response.state === 'NOT_EATING') return 'Không ăn'
  return 'Chưa trả lời'
}

function describeParentResponse(response: BreakfastDayResponse): string {
  if (response.state === 'SELECTED')
    return `Đã chọn · ${describeResponse(response)}`
  if (response.state === 'CUSTOM')
    return `Món tự chọn · ${describeResponse(response)}`
  if (response.state === 'NOT_EATING') return 'Không ăn'
  return 'Chưa trả lời'
}

function formatFamilyDate(date: string, timeZone: string): string {
  const instant = new Date(`${date}T12:00:00Z`)
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(instant)
}

function formatPurchaseTime(value: string, timeZone: string): string {
  return `Đã xác nhận lúc ${new Intl.DateTimeFormat('vi-VN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value))}`
}
