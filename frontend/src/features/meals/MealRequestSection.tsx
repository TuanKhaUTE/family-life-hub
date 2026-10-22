import { useEffect, useState, type FormEvent } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import {
  familyDate,
  relevantBreakfastDate,
  breakfastLifecycle,
} from './family-time'
import {
  updateMealRequest,
  fetchCurrentMealRequests,
  MealClosedApiError,
  saveMealResponse,
  type MealRequest,
  type MealSubmission,
} from './meal-request-api'
import './meals.css'
import { FinalMealSection } from './FinalMealSection'
import { MealPlanControls } from './MealPlanControls'
import { useFamilyClock } from './use-family-clock'

export function MealRequestSection({ profile }: { profile: FamilyProfile }) {
  const now = useFamilyClock(), today = familyDate(now), targetDate = relevantBreakfastDate(now), phase = breakfastLifecycle(targetDate, now).phase
  const [requests, setRequests] = useState<MealRequest[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    void fetchCurrentMealRequests()
      .then((items) => {
        if (active) {
          setRequests(
            items.filter(
              (item) =>
                (item.mealDate === today || item.mealDate === targetDate) &&
                item.mealType === 'DINNER' &&
                item.status !== 'CANCELLED',
            ),
          )
          setState('ready')
        }
      })
      .catch(() => {
        if (active) setState('error')
      })
    return () => {
      active = false
    }
  }, [reload, today, targetDate, phase])
  const replace = (item: MealRequest) =>
    setRequests((current) =>
      [
        ...current.filter((request) => request.id !== item.id),
        ...(item.status === 'CANCELLED' ? [] : [item]),
      ].sort(sortRequests),
    )
  if (state === 'loading')
    return (
      <section className="meals-card">
        <Heading />
        <p role="status">Đang chuẩn bị bàn ăn…</p>
      </section>
    )
  if (state === 'error')
    return (
      <section className="meals-card">
        <Heading />
        <p>Hiện chưa thể tải kế hoạch bữa tối hôm nay.</p>
        <button
          className="secondary-button"
          onClick={() => {
            setState('loading')
            setReload((value) => value + 1)
          }}
        >
          Thử tải lại
        </button>
      </section>
    )
  return (
    <>
      <section className="meals-card" aria-labelledby="meals-title">
        <Heading />
        <div className="meal-list">
          {!requests.some(r => r.mealDate === targetDate) ? (
            <p className="meal-empty">Chưa có câu hỏi cho chu kỳ này. Cả nhà thử tải lại nhé.</p>
          ) : (
            requests.filter(r => r.mealDate === targetDate).map((request) => (
              <MealCard
                key={request.id}
                request={request}
                profile={profile}
                onChanged={replace}
              />
            ))
          )}
        </div>
      </section>
      <FinalMealSection profile={profile} requests={requests} />
    </>
  )
}
function Heading() {
  return (
    <header className="meals-heading">
      <div>
        <p className="eyebrow">Bữa ăn gia đình</p>
        <h2 id="meals-title">Bữa tối nhà mình</h2>
      </div>
      <span aria-hidden="true">🍲</span>
    </header>
  )
}


function MealCard({
  request,
  profile,
  onChanged,
}: {
  request: MealRequest
  profile: FamilyProfile
  onChanged: (request: MealRequest) => void
}) {
  const now = useFamilyClock()
  request = {
    ...request,
    isOpen:
      request.isOpen &&
      request.status === 'OPEN' &&
      request.deadlineAt !== null &&
      breakfastLifecycle(request.mealDate, now).isOpen &&
      now.getTime() < Date.parse(request.deadlineAt),
  }
  return (
    <article
      className={`meal-request meal-request--${request.status.toLowerCase()}`}
    >
      <header>
        <div>
          <p className="eyebrow">
            {request.mealType === 'LUNCH' ? 'Bữa trưa' : 'Bữa tối'} ·{' '}
            {formatDate(request.mealDate, request.timeZone)}
          </p>
          <h3>
            {request.status === 'CANCELLED'
              ? 'Kế hoạch đã hủy'
              : request.status === 'SELF_SERVICE'
                ? 'Tự túc'
                : 'Tối mai tụi con muốn ăn gì?'}
          </h3>
        </div>
        <span className="meal-status">
          {request.status === 'CANCELLED'
            ? 'Kế hoạch đã hủy'
            : request.status === 'SELF_SERVICE'
              ? 'Tự túc'
              : request.isOpen
                ? 'Đang mở'
                : 'Đã đóng'}
        </span>
      </header>
      {request.parentMessage && (
        <p className="parent-note">“{request.parentMessage}”</p>
      )}
      {request.deadlineAt && request.status !== 'CANCELLED' && (
        <p className="meal-deadline">
          Trả lời từ 18:00 hôm trước đến 01:00 ngày ăn tối. Sau đó Mẹ xem để đi chợ nhé.
        </p>
      )}
      {profile.role === 'PARENT' ? (
        <DinnerParentView request={request} onChanged={onChanged} />
      ) : (
        <MemberRequestView
          request={request}
          profile={profile}
          onChanged={onChanged}
        />
      )}
    </article>
  )
}

function DinnerParentView({ request, onChanged }: { request: MealRequest; onChanged: (request: MealRequest) => void }) {
  const [message, setMessage] = useState(request.parentMessage ?? ''), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  return <div>
    {request.status !== 'SELF_SERVICE' && <ul className="response-list">{request.responses.map(r => <li key={r.member.id}><strong>{r.member.displayName}</strong><span>{responseLabel(r)}</span></li>)}</ul>}
    {editing ? <form className="meal-composer" onSubmit={async e => {
      e.preventDefault(); if (busy) return
      setBusy(true); setError(null)
      try { onChanged(await updateMealRequest(request.id, { parentMessage: message.trim() || null })); setEditing(false) } catch { setError('Chưa lưu được lời nhắn. Mẹ thử lại nhé.') } finally { setBusy(false) }
    }}><fieldset disabled={busy}><label>Gợi ý / lời nhắn của mẹ<textarea maxLength={300} value={message} onChange={e => setMessage(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<button className="primary-button">Lưu lời nhắn</button><button type="button" className="secondary-button" onClick={() => setEditing(false)}>Để sau</button></fieldset></form> : <button className="secondary-button" onClick={() => { setMessage(request.parentMessage ?? ''); setEditing(true) }}>Gợi ý / lời nhắn của mẹ</button>}
    <details><summary>Điều chỉnh kế hoạch bữa tối</summary><MealPlanControls key={request.updatedAt + request.status} request={request} onChanged={onChanged} /></details>
  </div>
}
function MemberRequestView({
  request,
  profile,
  onChanged,
}: {
  request: MealRequest
  profile: FamilyProfile
  onChanged: (request: MealRequest) => void
}) {
  const response = request.responses.find(
    (item) => item.member.id === profile.id,
  )
  const [editing, setEditing] = useState(
    !response || response.state === 'NO_RESPONSE',
  )
  const [draft, setDraft] = useState<MealSubmission | null>(() =>
    draftFrom(response),
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (request.status === 'CANCELLED')
    return (
      <p className="meal-closed" role="status">
        Kế hoạch bữa này đã hủy. Bạn không cần trả lời nữa nhé.
      </p>
    )
  if (request.status === 'SELF_SERVICE')
    return (
      <p className="self-service">
        <strong>Không cần phản hồi.</strong> Bạn hãy tự sắp xếp bữa ăn phù hợp
        nhé.
      </p>
    )
  if (!request.isOpen)
    return (
      <div className="meal-closed">
        <SavedResponse response={response} />
        <p role="status">Đã đóng phản hồi lúc 01:00. Chưa trả lời cũng không sao, Mẹ sẽ chọn giúp nhé.</p>
      </div>
    )
  if (response && response.state !== 'NO_RESPONSE' && !editing)
    return (
      <SavedResponse response={response} onChange={() => setEditing(true)} />
    )
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending || draft === null) return
    setPending(true)
    setError(null)
    try {
      const saved = await saveMealResponse(request.id, draft)
      onChanged({
        ...request,
        responses: request.responses.map((item) =>
          item.member.id === profile.id
            ? saved.responseType === 'NOT_EATING'
              ? {
                  ...item,
                  state: 'NOT_EATING' as const,
                  option: null,
                  customText: null,
                }
              : responseFromDraft(item, draft, request.options)
            : item,
        ),
      })
      setEditing(false)
    } catch (cause) {
      if (cause instanceof MealClosedApiError)
        onChanged({ ...request, status: 'CLOSED', isOpen: false })
      else setError('Chưa thể lưu lựa chọn của bạn. Vui lòng thử lại.')
    } finally {
      setPending(false)
    }
  }
  const text =
    draft?.responseType === 'CUSTOM'
      ? draft.customText
      : draft?.responseType === 'NOT_EATING'
        ? 'Hôm nay con không ăn tối'
        : draft?.responseType === 'SELECTED_OPTION'
          ? (request.options.find((o) => o.id === draft.optionId)?.label ?? '')
          : ''
  return (
    <form className="meal-response-form" onSubmit={submit}>
      {(!response || response.state === 'NO_RESPONSE') && (
        <p className="meal-empty">Chưa trả lời</p>
      )}
      <label>
        Bạn muốn ăn gì cho bữa tối này?
        <textarea
          autoFocus
          value={text}
          maxLength={120}
          placeholder="Con ăn cơm gà… hoặc: Hôm nay con không ăn tối"
          disabled={pending}
          onChange={(e) =>
            setDraft({ responseType: 'CUSTOM', customText: e.target.value })
          }
        />
      </label>
      {error && (
        <p role="alert" className="meal-error">
          {error}
        </p>
      )}
      <button className="primary-button" disabled={!text.trim() || pending}>
        {pending
          ? 'Đang lưu…'
          : response?.state && response.state !== 'NO_RESPONSE'
            ? 'Cập nhật lựa chọn'
            : 'Lưu lựa chọn'}
      </button>
    </form>
  )
}
function SavedResponse({
  response,
  onChange,
}: {
  response: MealRequest['responses'][number] | undefined
  onChange?: () => void
}) {
  return (
    <div className="saved-meal">
      <div>
        <strong>
          {response && response.state !== 'NO_RESPONSE'
            ? 'Đã lưu lựa chọn'
            : 'Chưa trả lời'}
        </strong>
        <span>{responseLabel(response)}</span>
      </div>
      {onChange && (
        <button className="secondary-button" onClick={onChange}>
          Đổi lựa chọn
        </button>
      )}
    </div>
  )
}
function responseLabel(response: MealRequest['responses'][number] | undefined) {
  if (!response || response.state === 'NO_RESPONSE') return 'Chưa trả lời'
  if (response.state === 'SELECTED_OPTION')
    return response.option?.label ?? 'Món đã chọn'
  if (response.state === 'CUSTOM') return response.customText ?? 'Món tự chọn'
  return 'Không ăn'
}
function draftFrom(
  response: MealRequest['responses'][number] | undefined,
): MealSubmission | null {
  if (response?.state === 'SELECTED_OPTION' && response.option)
    return { responseType: 'CUSTOM', customText: response.option.label }
  if (response?.state === 'CUSTOM')
    return { responseType: 'CUSTOM', customText: response.customText ?? '' }
  if (response?.state === 'NOT_EATING')
    return { responseType: 'CUSTOM', customText: 'Hôm nay con không ăn tối' }
  return { responseType: 'CUSTOM', customText: '' }
}
function responseFromDraft(
  current: MealRequest['responses'][number],
  draft: MealSubmission,
  options: MealRequest['options'],
): MealRequest['responses'][number] {
  return {
    ...current,
    state: draft.responseType,
    option:
      draft.responseType === 'SELECTED_OPTION'
        ? {
            id: draft.optionId,
            label:
              options.find((option) => option.id === draft.optionId)?.label ??
              'Món đã chọn',
          }
        : null,
    customText:
      draft.responseType === 'CUSTOM' ? draft.customText.trim() : null,
    updatedAt: new Date().toISOString(),
  }
}
function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone,
    dateStyle: 'medium',
  }).format(new Date(`${value}T12:00:00Z`))
}
function sortRequests(a: MealRequest, b: MealRequest) {
  return (
    a.mealDate.localeCompare(b.mealDate) || a.mealType.localeCompare(b.mealType)
  )
}
