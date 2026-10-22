import { useEffect, useRef, useState, type FormEvent } from 'react'
import { familyDate } from '../meals/family-time'
import {
  saveStudy,
  studyError,
  type StudyKind,
  type StudyRecord,
  type StudyWorkspace,
} from './study-api'
const titles = {
  semesters: 'Học kỳ',
  courses: 'Môn học',
  goals: 'Mục tiêu học tập',
  sessions: 'Buổi học',
}
export function StudyForm({
  kind,
  record,
  data,
  onClose,
  onSaved,
}: {
  kind: StudyKind
  record: StudyRecord | null
  data: StudyWorkspace
  onClose: () => void
  onSaved: () => void
}) {
  const initial = record as unknown as Record<string, unknown> | null
  const [name, setName] = useState(
      String(initial?.name ?? initial?.title ?? ''),
    ),
    [start, setStart] = useState(
      String(initial?.startDate ?? initial?.studiedAt ?? familyDate()),
    ),
    [end, setEnd] = useState(String(initial?.endDate ?? familyDate()))
  const [active, setActive] = useState(Boolean(initial?.isActive ?? true)),
    [semester, setSemester] = useState(
      String(
        initial?.semesterId ??
          data.semesters.find((s) => s.isActive)?.id ??
          data.semesters[0]?.id ??
          '',
      ),
    ),
    [course, setCourse] = useState(String(initial?.courseId ?? ''))
  const [code, setCode] = useState(String(initial?.code ?? '')),
    [minutes, setMinutes] = useState(
      String(initial?.durationMinutes ?? initial?.targetMinutes ?? ''),
    ),
    [target, setTarget] = useState(String(initial?.targetDate ?? '')),
    [note, setNote] = useState(String(initial?.note ?? '')),
    [completed, setCompleted] = useState(initial?.status === 'COMPLETED')
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const input =
      kind === 'semesters'
        ? {
            name: name.trim(),
            startDate: start,
            endDate: end,
            isActive: active,
          }
        : kind === 'courses'
          ? {
              name: name.trim(),
              semesterId: semester,
              code: code.trim() || null,
            }
          : kind === 'goals'
            ? {
                title: name.trim(),
                courseId: course || null,
                targetMinutes: minutes ? Number(minutes) : null,
                targetDate: target || null,
                status: completed ? 'COMPLETED' : 'ACTIVE',
              }
            : {
                courseId: course || null,
                studiedAt: start,
                durationMinutes: Number(minutes),
                note: note.trim() || null,
              }
    try {
      await saveStudy(kind, record?.id ?? null, input)
      onSaved()
    } catch (error) {
      setError(studyError(error))
      setPending(false)
    }
  }
  return (
    <section className="study-form">
      <div className="study-heading">
        <h3 ref={heading} tabIndex={-1}>
          {record ? 'Chỉnh sửa: ' : ''}
          {titles[kind]}
        </h3>
        <button type="button" disabled={pending} onClick={onClose}>
          Đóng biểu mẫu
        </button>
      </div>
      <form aria-label={titles[kind]} onSubmit={submit}>
        <fieldset disabled={pending}>
          {kind !== 'sessions' && (
            <label>
              {kind === 'goals'
                ? 'Tên mục tiêu'
                : kind === 'courses'
                  ? 'Tên môn'
                  : 'Tên học kỳ'}
              <input
                required
                maxLength={kind === 'goals' ? 160 : 120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          {kind === 'semesters' && (
            <>
              <label>
                Ngày bắt đầu
                <input
                  required
                  type="date"
                  min="2000-01-01"
                  max="2199-12-31"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Ngày kết thúc
                <input
                  required
                  type="date"
                  min={start}
                  max="2199-12-31"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <label className="study-check">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Học kỳ đang học
              </label>
            </>
          )}
          {kind === 'courses' && (
            <>
              <label>
                Học kỳ
                <select
                  required
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                >
                  <option value="">Chọn học kỳ</option>
                  {data.semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {!data.semesters.length && (
                <p>Bạn thêm học kỳ trước rồi thêm môn nhé.</p>
              )}
              <label>
                Mã môn (không bắt buộc)
                <input
                  maxLength={40}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
            </>
          )}
          {(kind === 'goals' || kind === 'sessions') && (
            <label>
              Môn học (không bắt buộc)
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              >
                <option value="">Không gắn môn học</option>
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'sessions' && (
            <>
              <label>
                Ngày học
                <input
                  required
                  type="date"
                  min="2000-01-01"
                  max={familyDate()}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Thời lượng (phút)
                <input
                  required
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </label>
              <label>
                Ghi chú (không bắt buộc)
                <textarea
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </>
          )}
          {kind === 'goals' && (
            <>
              <label>
                Mục tiêu thời gian tuần này (phút, không bắt buộc)
                <input
                  type="number"
                  min={1}
                  max={10080}
                  step={1}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </label>
              <p className="study-muted">
                Tiến độ tính từ các buổi học trong tuần, theo môn bạn chọn hoặc
                toàn bộ môn.
              </p>
              <label>
                Ngày mục tiêu (không bắt buộc)
                <input
                  type="date"
                  min="2000-01-01"
                  max="2199-12-31"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>
              {record && (
                <label className="study-check">
                  <input
                    type="checkbox"
                    checked={completed}
                    onChange={(e) => setCompleted(e.target.checked)}
                  />
                  Đã hoàn thành
                </label>
              )}
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <button className="study-primary" type="submit">
            {pending ? 'Đang lưu…' : 'Lưu lại'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}
