import { useEffect, useRef, useState, type FormEvent } from 'react'
import { familyDate } from '../meals/family-time'
import {
  ACTIVITY_LEVELS,
  saveWellnessProfile,
  saveWeight,
  wellnessError,
  type WellnessWorkspace,
  type WellnessProfile,
  type WeightLog,
} from './wellness-api'

export function WellnessForm({
  mode,
  record,
  data,
  onClose,
  onSaved,
}: {
  mode: 'profile' | 'weight'
  record: WeightLog | null
  data: WellnessWorkspace
  onClose: () => void
  onSaved: () => void
}) {
  const [height, setHeight] = useState(String(data.profile?.heightCm ?? ''))
  const [target, setTarget] = useState(
    String(data.profile?.targetWeightKg ?? ''),
  )
  const [activity, setActivity] = useState(data.profile?.activityLevel ?? '')
  const [date, setDate] = useState(record?.loggedDate ?? familyDate())
  const [weight, setWeight] = useState(String(record?.weightKg ?? ''))
  const [note, setNote] = useState(record?.note ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      if (mode === 'profile')
        await saveWellnessProfile({
          heightCm: height ? Number(height) : null,
          targetWeightKg: target ? Number(target) : null,
          activityLevel: activity
            ? (activity as WellnessProfile['activityLevel'])
            : null,
        })
      else
        await saveWeight(record?.id ?? null, {
          loggedDate: date,
          weightKg: Number(weight),
          note: note.trim() || null,
        })
      onSaved()
    } catch (error) {
      setError(wellnessError(error))
      setPending(false)
    }
  }
  return (
    <section className="wellness-form">
      <h4 ref={heading} tabIndex={-1}>
        {mode === 'profile'
          ? 'Thông tin thể trạng của bạn'
          : record
            ? 'Chỉnh sửa lần cân'
            : 'Ghi cân nặng'}
      </h4>
      <button disabled={pending} onClick={onClose}>
        Đóng biểu mẫu thể trạng
      </button>
      <form
        aria-label={mode === 'profile' ? 'Thông tin thể trạng' : 'Lần cân'}
        onSubmit={submit}
      >
        <fieldset disabled={pending}>
          {mode === 'profile' ? (
            <>
              <label>
                Chiều cao (cm, không bắt buộc)
                <input
                  type="number"
                  min={100}
                  max={250}
                  step="0.01"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </label>
              <label>
                Cân nặng mục tiêu (kg, không bắt buộc)
                <input
                  type="number"
                  min={20}
                  max={350}
                  step="0.01"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>
              <label>
                Mức vận động (không bắt buộc)
                <select
                  value={activity}
                  onChange={(e) =>
                    setActivity(e.target.value as typeof activity)
                  }
                >
                  <option value="">Chưa chọn</option>
                  {ACTIVITY_LEVELS.map((level, i) => (
                    <option key={level} value={level}>
                      {
                        [
                          'Ít vận động',
                          'Vận động nhẹ',
                          'Vận động vừa',
                          'Vận động nhiều',
                          'Vận động rất nhiều',
                        ][i]
                      }
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Để trống để bỏ thông tin đã lưu. Mức vận động chỉ lưu lựa chọn
                của bạn, chưa dùng để ước tính năng lượng.
              </p>
            </>
          ) : (
            <>
              <label>
                Ngày cân
                <input
                  type="date"
                  required
                  min="2000-01-01"
                  max={familyDate()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                Cân nặng (kg)
                <input
                  type="number"
                  required
                  min={20}
                  max={350}
                  step="0.01"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </label>
              <label>
                Ghi chú lần cân (không bắt buộc)
                <textarea
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <p>
                Mỗi ngày giữ một lần cân. Nếu đã ghi hôm đó, bạn sửa lần cân
                trong lịch sử nhé.
              </p>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <button type="submit" className="wellness-primary">
            {pending
              ? 'Đang lưu…'
              : mode === 'profile'
                ? 'Lưu thông tin'
                : 'Lưu cân nặng'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}
