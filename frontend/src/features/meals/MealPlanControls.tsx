import { useRef, useState, type FormEvent } from 'react'
import { localInputToUtc, toLocalDateTimeInput } from './family-time'
import {
  MealConflictApiError,
  MealResetRequiredApiError,
  updateMealRequest,
  type MealMode,
  type MealRequest,
} from './meal-request-api'

export function MealPlanControls({
  request,
  onChanged,
}: {
  request: MealRequest
  onChanged: (request: MealRequest) => void
}) {
  const [editing, setEditing] = useState(false)
  const [mode, setMode] = useState<MealMode | 'SELF_SERVICE'>(
    request.mode ?? 'SELF_SERVICE',
  )
  const [deadline, setDeadline] = useState(() =>
    toLocalDateTimeInput(
      new Date(
        request.deadlineAt && Date.parse(request.deadlineAt) > Date.now()
          ? request.deadlineAt
          : Date.now() + 3 * 60 * 60 * 1000,
      ),
    ),
  )
  const [options, setOptions] = useState(
    request.options.length
      ? request.options.map((option) => option.label)
      : ['', ''],
  )
  const [message, setMessage] = useState(request.parentMessage ?? '')
  const [confirmation, setConfirmation] = useState<'reset' | 'cancel' | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const guard = useRef(false)
  const normalizedOptions = options.map((option) => option.trim())
  const valid =
    mode !== 'OPTION_POLL' ||
    (normalizedOptions.length >= 2 &&
      normalizedOptions.length <= 5 &&
      normalizedOptions.every(Boolean) &&
      new Set(normalizedOptions.map((option) => option.toLocaleLowerCase()))
        .size === normalizedOptions.length)
  const invalidatesResponses = request.responses.some(
    (response) =>
      response.state !== 'NO_RESPONSE' &&
      (mode === 'SELF_SERVICE' ||
        (response.state === 'CUSTOM' && mode !== 'OPEN_CHOICE') ||
        (response.state === 'SELECTED_OPTION' &&
          (mode !== 'OPTION_POLL' ||
            !normalizedOptions.includes(response.option?.label ?? '')))),
  )
  async function save(confirmed = false) {
    if (guard.current) return
    const deadlineAt =
      mode === 'SELF_SERVICE' ? null : localInputToUtc(deadline)
    if (
      !valid ||
      (mode !== 'SELF_SERVICE' &&
        (!deadlineAt || Date.parse(deadlineAt) <= Date.now()))
    ) {
      setError(
        'Mẹ chọn hạn trả lời trong tương lai và điền đủ các lựa chọn nhé.',
      )
      return
    }
    if (invalidatesResponses && !confirmed) {
      setConfirmation('reset')
      return
    }
    guard.current = true
    setPending(true)
    setError(null)
    try {
      onChanged(
        await updateMealRequest(request.id, {
          status: mode === 'SELF_SERVICE' ? 'SELF_SERVICE' : 'OPEN',
          mode,
          deadlineAt,
          parentMessage: message.trim() || null,
          options: mode === 'OPTION_POLL' ? normalizedOptions : [],
          confirmResponseReset: confirmed,
        }),
      )
      setEditing(false)
      setConfirmation(null)
      window.dispatchEvent(new Event('family-notifications-changed'))
    } catch (cause) {
      if (cause instanceof MealResetRequiredApiError) setConfirmation('reset')
      else
        setError(
          cause instanceof MealConflictApiError
            ? 'Bữa này đã có món sẽ nấu, nên chưa thể chuyển sang tự túc. Mẹ chọn cách trả lời khác nhé.'
            : 'Chưa thể lưu kế hoạch. Mẹ thử lại nhé.',
        )
    } finally {
      guard.current = false
      setPending(false)
    }
  }
  async function cancel() {
    if (guard.current) return
    guard.current = true
    setPending(true)
    setError(null)
    try {
      onChanged(await updateMealRequest(request.id, { status: 'CANCELLED' }))
      setConfirmation(null)
      setEditing(false)
      window.dispatchEvent(new Event('family-notifications-changed'))
    } catch {
      setError('Chưa thể hủy kế hoạch. Mẹ thử lại nhé.')
    } finally {
      guard.current = false
      setPending(false)
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    void save()
  }
  return (
    <div className="meal-plan-controls">
      {request.status === 'SELF_SERVICE' && (
        <p>Mọi người tự sắp xếp bữa ăn này nhé.</p>
      )}
      {request.status !== 'SELF_SERVICE' && (
        <ul className="response-list">
          {request.responses.map((response) => (
            <li key={response.member.id}>
              <strong>{response.member.displayName}</strong>
              <span>
                {response.state === 'NO_RESPONSE'
                  ? 'Chưa trả lời'
                  : response.state === 'NOT_EATING'
                    ? 'Không ăn'
                    : (response.option?.label ??
                      response.customText ??
                      'Món tự chọn')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <form className="meal-composer" onSubmit={submit}>
          <fieldset disabled={pending || confirmation !== null}>
            <legend>Chỉnh sửa kế hoạch bữa ăn</legend>
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
                <option value="SELF_SERVICE">Tự túc</option>
              </select>
            </label>
            {mode !== 'SELF_SERVICE' && (
              <label>
                Hạn trả lời
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              </label>
            )}
            {mode === 'OPTION_POLL' && (
              <div className="poll-options">
                <p>Các lựa chọn (2–5)</p>
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
                    className="text-button add-meal-option"
                    onClick={() => setOptions((current) => [...current, ''])}
                  >
                    Thêm lựa chọn
                  </button>
                )}
              </div>
            )}
            <label>
              Lời nhắn cho cả nhà
              <textarea
                maxLength={300}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
          </fieldset>
          <div className="meal-actions">
            <button
              className="primary-button"
              disabled={pending || !valid || confirmation !== null}
            >
              {pending ? 'Đang lưu…' : 'Lưu kế hoạch'}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={pending}
              onClick={() => {
                setEditing(false)
                setConfirmation(null)
                setError(null)
              }}
            >
              Thôi chỉnh sửa
            </button>
          </div>
        </form>
      ) : (
        <div className="meal-actions">
          <button
            className="secondary-button"
            onClick={() => {
              setEditing(true)
              setError(null)
            }}
          >
            Chỉnh sửa
          </button>
          {request.status !== 'CANCELLED' && (
            <button
              className="text-button"
              onClick={() => setConfirmation('cancel')}
            >
              Hủy kế hoạch
            </button>
          )}
        </div>
      )}
      {confirmation && (
        <div
          className="meal-confirmation"
          role="alertdialog"
          aria-label={
            confirmation === 'reset'
              ? 'Xác nhận thay đổi'
              : 'Xác nhận hủy kế hoạch'
          }
        >
          <p>
            {confirmation === 'reset'
              ? 'Một số phản hồi hiện tại sẽ không còn phù hợp với kế hoạch mới. Chỉ các phản hồi không còn phù hợp sẽ bị xóa; cả nhà cần chọn lại nếu cần. Mẹ có muốn tiếp tục không?'
              : 'Hủy kế hoạch bữa này? Yêu cầu và phản hồi vẫn được lưu, nhưng cả nhà không thể trả lời thêm.'}
          </p>
          <div className="meal-actions">
            <button
              className="primary-button"
              disabled={pending}
              onClick={() =>
                confirmation === 'reset' ? void save(true) : void cancel()
              }
            >
              {confirmation === 'reset'
                ? 'Đồng ý, lưu kế hoạch'
                : 'Đồng ý, hủy kế hoạch'}
            </button>
            <button
              className="secondary-button"
              disabled={pending}
              onClick={() => setConfirmation(null)}
            >
              Quay lại
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="meal-error">
          {error}
        </p>
      )}
    </div>
  )
}
