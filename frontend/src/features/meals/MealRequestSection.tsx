import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import {
  familyDate,
  localInputToUtc,
  defaultDinnerDeadline,
} from './family-time'
import {
  createMealRequest,
  fetchCurrentMealRequests,
  MealClosedApiError,
  MealConflictApiError,
  MealResetRequiredApiError,
  saveMealResponse,
  type CreateMealRequest,
  type MealRequest,
  type MealSubmission,
} from './meal-request-api'
import './meals.css'
import { FinalMealSection } from './FinalMealSection'
import { MealPlanControls } from './MealPlanControls'
import { useFamilyClock } from './use-family-clock'

export function MealRequestSection({ profile }: { profile: FamilyProfile }) {
  const today = familyDate(useFamilyClock())
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
                item.mealDate === today &&
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
  }, [reload, today])
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
        {profile.role === 'PARENT' && requests.length === 0 && (
          <ParentComposer onCreated={replace} />
        )}
        <div className="meal-list">
          {requests.length === 0 ? (
            <p className="meal-empty">Chưa có kế hoạch bữa tối hôm nay.</p>
          ) : (
            requests.map((request) => (
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
        <h2 id="meals-title">Bữa tối hôm nay</h2>
      </div>
      <span aria-hidden="true">🍲</span>
    </header>
  )
}

function ParentComposer({
  onCreated,
}: {
  onCreated: (request: MealRequest) => void
}) {
  const [open, setOpen] = useState(false),
    [deadline, setDeadline] = useState(() => defaultDinnerDeadline()),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [confirmReset, setConfirmReset] = useState(false)
  const selfService = useRef(false),
    guard = useRef(false)
  async function submit(event?: FormEvent, confirmed = false, self = false) {
    event?.preventDefault()
    if (guard.current) return
    selfService.current = self
    const mealDate = familyDate(),
      deadlineAt = localInputToUtc(mealDate + 'T' + deadline)
    if (!self && (!deadlineAt || Date.parse(deadlineAt) <= Date.now())) {
      setError('Mẹ chọn giờ trả lời sau thời điểm hiện tại nhé.')
      return
    }
    guard.current = true
    setPending(true)
    setError(null)
    try {
      const saved = await createMealRequest({
        mealDate,
        mealType: 'DINNER',
        mode: self ? 'SELF_SERVICE' : 'OPEN_CHOICE',
        ...(self ? {} : { deadlineAt: deadlineAt! }),
        parentMessage: message.trim() || null,
        ...(confirmed ? { confirmResponseReset: true } : {}),
      } as CreateMealRequest)
      onCreated(saved)
      setOpen(false)
      setMessage('')
      setConfirmReset(false)
    } catch (cause) {
      if (cause instanceof MealResetRequiredApiError) setConfirmReset(true)
      else
        setError(
          cause instanceof MealConflictApiError
            ? 'Bữa tối đã có kế hoạch. Mẹ mở thẻ hiện có và chọn “Chỉnh sửa” nhé.'
            : 'Chưa thể gửi câu hỏi. Mẹ kiểm tra hạn trả lời rồi thử lại nhé.',
        )
    } finally {
      guard.current = false
      setPending(false)
    }
  }
  if (!open)
    return (
      <button
        className="primary-button meal-create-button"
        onClick={() => setOpen(true)}
      >
        Lên kế hoạch bữa ăn
      </button>
    )
  return (
    <form
      className="meal-composer"
      onSubmit={(e) => void submit(e, false, false)}
    >
      <h3>Hôm nay mọi người muốn ăn gì?</h3>
      <label>
        Lời nhắn cho cả nhà
        <textarea
          autoFocus
          value={message}
          maxLength={300}
          placeholder="Mẹ có cơm gà, bún bò hoặc phở, hai đứa nói mẹ biết nha."
          onChange={(e) => setMessage(e.target.value)}
          disabled={pending}
        />
      </label>
      <label>
        Hạn trả lời
        <input
          type="time"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          required
          disabled={pending}
        />
      </label>
      <p>Giờ gia đình · mặc định 14:00 hôm nay.</p>
      {error && (
        <p role="alert" className="meal-error">
          {error}
        </p>
      )}
      <div className="meal-actions">
        <button className="primary-button" disabled={pending || confirmReset}>
          {pending ? 'Đang gửi…' : 'Tạo yêu cầu'}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Hủy
        </button>
        <button
          type="button"
          className="text-button"
          disabled={pending || confirmReset}
          onClick={() => void submit(undefined, false, true)}
        >
          Để cả nhà tự túc
        </button>
      </div>
      {confirmReset && (
        <div role="alertdialog" aria-label="Xác nhận tạo lại kế hoạch">
          <p>
            Kế hoạch mới sẽ bỏ các phản hồi cũ không còn phù hợp. Mẹ có muốn
            tiếp tục không?
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => void submit(undefined, true, selfService.current)}
          >
            Đồng ý, tạo lại kế hoạch
          </button>
          <button type="button" onClick={() => setConfirmReset(false)}>
            Quay lại
          </button>
        </div>
      )}
    </form>
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
                : 'Hôm nay mọi người muốn ăn gì?'}
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
          Trả lời trước {formatDeadline(request.deadlineAt, request.timeZone)}
        </p>
      )}
      {profile.role === 'PARENT' ? (
        <MealPlanControls
          key={request.updatedAt + request.status}
          request={request}
          onChanged={onChanged}
        />
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
        <p role="status">Đã đóng phản hồi.</p>
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
        Bạn muốn ăn gì tối nay?
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
function formatDeadline(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
function sortRequests(a: MealRequest, b: MealRequest) {
  return (
    a.mealDate.localeCompare(b.mealDate) || a.mealType.localeCompare(b.mealType)
  )
}
