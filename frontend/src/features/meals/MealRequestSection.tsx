import { useEffect, useState, type FormEvent } from 'react'
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
  type MealMode,
  type MealRequest,
  type MealSubmission,
} from './meal-request-api'
import './meals.css'
import { FinalMealSection } from './FinalMealSection'
import { MealPlanControls } from './MealPlanControls'

export function MealRequestSection({ profile }: { profile: FamilyProfile }) {
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
                item.mealDate === familyDate() &&
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
  }, [reload])
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
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const mealDate = familyDate()
  const mealType = 'DINNER' as const
  const [mode, setMode] = useState<MealMode | 'SELF_SERVICE'>('OPEN_CHOICE')
  const [deadline, setDeadline] = useState(() => defaultDinnerDeadline())
  const [options, setOptions] = useState(['', ''])
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const normalizedOptions = options.map((value) => value.trim())
  const optionsAreValid =
    normalizedOptions.length >= 2 &&
    normalizedOptions.length <= 5 &&
    normalizedOptions.every(Boolean) &&
    new Set(normalizedOptions.map((value) => value.toLocaleLowerCase()))
      .size === normalizedOptions.length
  const setPreset = (preset: 'NOON' | 'THREE_HOURS') =>
    setDeadline(preset === 'NOON' ? '12:00' : defaultDinnerDeadline())
  async function submit(event?: FormEvent, confirmed = false) {
    event?.preventDefault()
    if (pending) return
    const deadlineAt =
      mode === 'SELF_SERVICE'
        ? null
        : localInputToUtc(`${mealDate}T${deadline}`)
    if (mode !== 'SELF_SERVICE' && !deadlineAt) {
      setError('Hãy chọn thời hạn hợp lệ.')
      return
    }
    let input: CreateMealRequest
    if (mode === 'SELF_SERVICE')
      input = {
        mealDate,
        mealType,
        mode,
        parentMessage: message.trim() || null,
      }
    else if (mode === 'OPTION_POLL')
      input = {
        mealDate,
        mealType,
        mode,
        deadlineAt: deadlineAt!,
        parentMessage: message.trim() || null,
        options: normalizedOptions,
      }
    else
      input = {
        mealDate,
        mealType,
        mode,
        deadlineAt: deadlineAt!,
        parentMessage: message.trim() || null,
      }
    setPending(true)
    setError(null)
    try {
      const saved = await createMealRequest({
        ...input,
        ...(confirmed ? { confirmResponseReset: true } : {}),
      })
      onCreated(saved)
      setOpen(false)
      setMessage('')
      setOptions(['', ''])
    } catch (cause) {
      if (cause instanceof MealResetRequiredApiError) {
        setConfirmReset(true)
        return
      }
      setError(
        cause instanceof MealConflictApiError ||
          cause instanceof MealResetRequiredApiError
          ? 'Bữa ăn này đã có kế hoạch. Hãy chọn “Chỉnh sửa” trong thẻ hiện có.'
          : 'Chưa thể lưu kế hoạch bữa ăn. Vui lòng thử lại.',
      )
    } finally {
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
    <form className="meal-composer" onSubmit={(event) => void submit(event)}>
      <div className="meal-form-grid">
        <label>
          Cách cả nhà trả lời
          <select
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as MealMode | 'SELF_SERVICE')
            }
          >
            <option value="OPEN_CHOICE">Hỏi mọi người</option>
            <option value="OPTION_POLL">Tạo lựa chọn</option>
            <option value="SELF_SERVICE">Mọi người tự túc</option>
          </select>
        </label>
      </div>
      {mode !== 'SELF_SERVICE' && (
        <fieldset className="deadline-field">
          <legend>Hạn trả lời</legend>
          <div className="deadline-presets">
            <button type="button" onClick={() => setPreset('NOON')}>
              12:00 hôm nay
            </button>
            <button type="button" onClick={() => setPreset('THREE_HOURS')}>
              Sau 3 giờ
            </button>
          </div>
          <label>
            Giờ trả lời hôm nay
            <input
              type="time"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
        </fieldset>
      )}
      {mode === 'OPTION_POLL' && (
        <fieldset>
          <legend>Các lựa chọn (2–5)</legend>
          {options.map((option, index) => (
            <div className="meal-option-input" key={index}>
              <label>
                Lựa chọn {index + 1}
                <input
                  value={option}
                  maxLength={120}
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((value, i) =>
                        i === index ? event.target.value : value,
                      ),
                    )
                  }
                />
              </label>
              {options.length > 2 && (
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Xóa lựa chọn ${index + 1}`}
                  onClick={() =>
                    setOptions((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  Xóa
                </button>
              )}
            </div>
          ))}
          {options.length < 5 && (
            <button
              type="button"
              className="text-button"
              onClick={() => setOptions((current) => [...current, ''])}
            >
              Thêm lựa chọn
            </button>
          )}
        </fieldset>
      )}
      <label>
        Lời nhắn cho cả nhà
        <textarea
          value={message}
          maxLength={300}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="meal-error">
          {error}
        </p>
      )}
      <div className="meal-actions">
        <button
          className="primary-button"
          disabled={pending || (mode === 'OPTION_POLL' && !optionsAreValid)}
        >
          {pending
            ? 'Đang lưu…'
            : mode === 'OPTION_POLL'
              ? 'Tạo bình chọn'
              : mode === 'SELF_SERVICE'
                ? 'Xác nhận tự túc'
                : 'Tạo yêu cầu'}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setOpen(false)}
        >
          Hủy
        </button>
      </div>
      {confirmReset && (
        <div role="alertdialog" aria-label="Xác nhận tạo lại kế hoạch">
          <p>
            Kế hoạch mới sẽ bỏ những phản hồi cũ không còn phù hợp. Mẹ có muốn
            tạo lại không?
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={pending}
            onClick={() => void submit(undefined, true)}
          >
            Đồng ý, tạo lại kế hoạch
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setConfirmReset(false)}
          >
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
                : request.mode === 'OPTION_POLL'
                  ? 'Chọn một món'
                  : 'Bạn muốn ăn gì?'}
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
      await saveMealResponse(request.id, draft)
      onChanged({
        ...request,
        responses: request.responses.map((item) =>
          item.member.id === profile.id
            ? responseFromDraft(item, draft, request.options)
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
  const valid =
    draft !== null &&
    (draft.responseType === 'NOT_EATING' ||
      (draft.responseType === 'CUSTOM' && draft.customText.trim().length > 0) ||
      draft.responseType === 'SELECTED_OPTION')
  return (
    <form className="meal-response-form" onSubmit={submit}>
      {(!response || response.state === 'NO_RESPONSE') && (
        <p className="meal-empty">Chưa trả lời</p>
      )}
      <fieldset>
        <legend>Lựa chọn của bạn</legend>
        {request.mode === 'OPTION_POLL' ? (
          request.options.map((option) => (
            <ResponseChoice
              key={option.id}
              name={`meal-response-${request.id}`}
              label={option.label}
              checked={
                draft?.responseType === 'SELECTED_OPTION' &&
                draft.optionId === option.id
              }
              onClick={() =>
                setDraft({
                  responseType: 'SELECTED_OPTION',
                  optionId: option.id,
                })
              }
            />
          ))
        ) : (
          <ResponseChoice
            name={`meal-response-${request.id}`}
            label="Món tự chọn"
            checked={draft?.responseType === 'CUSTOM'}
            onClick={() =>
              setDraft({
                responseType: 'CUSTOM',
                customText:
                  draft?.responseType === 'CUSTOM' ? draft.customText : '',
              })
            }
          />
        )}
        <ResponseChoice
          name={`meal-response-${request.id}`}
          label="Không ăn"
          checked={draft?.responseType === 'NOT_EATING'}
          onClick={() => setDraft({ responseType: 'NOT_EATING' })}
        />
      </fieldset>
      {draft?.responseType === 'CUSTOM' && (
        <label>
          Món bạn muốn ăn
          <input
            value={draft.customText}
            maxLength={120}
            onChange={(event) =>
              setDraft({
                responseType: 'CUSTOM',
                customText: event.target.value,
              })
            }
          />
        </label>
      )}
      {error && (
        <p role="alert" className="meal-error">
          {error}
        </p>
      )}
      <button className="primary-button" disabled={!valid || pending}>
        {pending
          ? 'Đang lưu…'
          : response?.state && response.state !== 'NO_RESPONSE'
            ? 'Cập nhật lựa chọn'
            : 'Lưu lựa chọn'}
      </button>
    </form>
  )
}

function ResponseChoice({
  name,
  label,
  checked,
  onClick,
}: {
  name: string
  label: string
  checked: boolean
  onClick: () => void
}) {
  return (
    <label className={`meal-choice${checked ? ' is-selected' : ''}`}>
      <input type="radio" name={name} checked={checked} onChange={onClick} />
      <span>{label}</span>
      <i aria-hidden="true">{checked ? '✓' : ''}</i>
    </label>
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
    return { responseType: 'SELECTED_OPTION', optionId: response.option.id }
  if (response?.state === 'CUSTOM')
    return { responseType: 'CUSTOM', customText: response.customText ?? '' }
  if (response?.state === 'NOT_EATING') return { responseType: 'NOT_EATING' }
  return null
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
