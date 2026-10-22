import { useEffect, useRef, useState, type FormEvent } from 'react'
import { saveStudy } from './study-api'
import {
  ASSESSMENT_TYPES,
  gradesError,
  type Assessment,
  type AssessmentInput,
} from './grades-api'
import { ASSESSMENT_LABELS } from './grade-display'
export function AssessmentForm({
  assessment,
  courses,
  defaultCourse,
  onClose,
  onSaved,
}: {
  assessment: Assessment | null
  courses: { id: string; name: string }[]
  defaultCourse: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [course, setCourse] = useState(
      assessment?.courseId ?? defaultCourse ?? courses[0]?.id ?? '',
    ),
    [title, setTitle] = useState(assessment?.title ?? ''),
    [type, setType] = useState<AssessmentInput['assessmentType']>(
      assessment?.assessmentType ?? 'OTHER',
    ),
    [score, setScore] = useState(String(assessment?.score ?? '')),
    [max, setMax] = useState(String(assessment?.maxScore ?? '')),
    [letter, setLetter] = useState(assessment?.letterGrade ?? ''),
    [weight, setWeight] = useState(String(assessment?.weightPercent ?? '')),
    [date, setDate] = useState(assessment?.assessedAt ?? ''),
    [note, setNote] = useState(assessment?.note ?? ''),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const s = score === '' ? null : Number(score),
      m = max === '' ? null : Number(max),
      w = weight === '' ? null : Number(weight)
    if (
      !title.trim() ||
      !course ||
      (s !== null && (m === null || m <= 0 || s < 0 || s > m)) ||
      (m !== null && m <= 0) ||
      (w !== null && (w < 0 || w > 100))
    ) {
      setError('Bạn kiểm tra tên bài, môn học, điểm tối đa và trọng số nhé.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await saveStudy('assessments', assessment?.id ?? null, {
        courseId: course,
        title: title.trim(),
        assessmentType: type,
        score: s,
        maxScore: m,
        letterGrade: letter.trim() || null,
        weightPercent: w,
        assessedAt: date || null,
        note: note.trim() || null,
      })
      onSaved()
    } catch (error) {
      setError(gradesError(error))
      setPending(false)
    }
  }
  return (
    <section className="study-form">
      <div className="study-heading">
        <h2 ref={heading} tabIndex={-1}>
          {assessment ? 'Chỉnh sửa điểm' : 'Thêm điểm'}
        </h2>
        <button disabled={pending} onClick={onClose}>
          Đóng biểu mẫu
        </button>
      </div>
      <form aria-label="Thông tin điểm" onSubmit={submit}>
        <fieldset disabled={pending}>
          <label>
            Môn học
            <select
              required
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            >
              <option value="">Chọn môn học</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tên bài
            <input
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Loại
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as AssessmentInput['assessmentType'])
              }
            >
              {ASSESSMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ASSESSMENT_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Điểm đạt được (không bắt buộc)
            <input
              type="number"
              min={0}
              max={1000000}
              step="0.0001"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </label>
          <label>
            Điểm tối đa (không bắt buộc)
            <input
              type="number"
              min="0.0001"
              max={1000000}
              step="0.0001"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </label>
          <label>
            Điểm chữ (không bắt buộc)
            <input
              maxLength={20}
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
            />
          </label>
          <label>
            Trọng số (%, không bắt buộc)
            <input
              type="number"
              min={0}
              max={100}
              step="0.0001"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
          <label>
            Ngày (không bắt buộc)
            <input
              type="date"
              min="2000-01-01"
              max="2199-12-31"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
          {error && <p role="alert">{error}</p>}
          <button className="study-primary" type="submit">
            {pending ? 'Đang lưu…' : 'Lưu điểm'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}
