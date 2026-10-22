import { useEffect, useRef, useState } from 'react'
import { deleteStudy } from './study-api'
import {
  fetchGrades,
  gradesError,
  type GradeView,
  type Assessment,
} from './grades-api'
import {
  gradeNumber,
  gradeScore,
  gradeDate,
  ASSESSMENT_LABELS,
} from './grade-display'
import { AssessmentForm } from './AssessmentForm'
import './study.css'
import { AssessmentSharing } from '../sharing/AssessmentSharing'
export function StudyGrades({
  onClose,
  backLabel = 'Về Học tập',
}: {
  onClose: () => void
  backLabel?: string
}) {
  const [data, setData] = useState<GradeView | null>(null),
    [course, setCourse] = useState<string | null>(null),
    [version, setVersion] = useState(0),
    [loaded, setLoaded] = useState(''),
    [failed, setFailed] = useState(false),
    [form, setForm] = useState<{ assessment: Assessment | null } | null>(null),
    [remove, setRemove] = useState<Assessment | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null)
  // Keep the full course selector stable while the server filters owned results.
  const [courses, setCourses] = useState<GradeView['courses']>([])
  const key = `${course}:${version}`,
    heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  useEffect(() => {
    const controller = new AbortController()
    void fetchGrades(course, controller.signal)
      .then((view) => {
        if (!controller.signal.aborted) {
          setData(view)
          if (course === null) setCourses(view.courses)
          setFailed(false)
          setLoaded(key)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true)
          setLoaded(key)
        }
      })
    return () => controller.abort()
  }, [course, key, version])
  function saved() {
    setForm(null)
    setMessage('Đã lưu điểm của bạn.')
    setVersion((v) => v + 1)
  }
  async function confirmDelete() {
    if (!remove || pending) return
    setPending(true)
    setError(null)
    try {
      await deleteStudy('assessments', remove.id)
      setRemove(null)
      setMessage('Đã xóa bài bạn chọn.')
      setVersion((v) => v + 1)
    } catch (error) {
      setError(gradesError(error))
    } finally {
      setPending(false)
    }
  }
  const loading = loaded !== key
  return (
    <div className="study-page grades-page">
      <header className="study-hero">
        <button onClick={onClose}>{backLabel}</button>
        <h1 ref={heading} tabIndex={-1}>
          Điểm môn học
        </h1>
        <p>Một góc riêng để nhìn lại kết quả học tập, theo nhịp của bạn.</p>
      </header>
      <section className="study-section">
        <div className="study-heading">
          <label className="grades-filter">
            Lọc theo môn
            <select
              value={course ?? ''}
              onChange={(e) => {
                setCourse(e.target.value || null)
                setForm(null)
                setRemove(null)
                setMessage(null)
                setError(null)
              }}
            >
              <option value="">Tất cả môn học</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="study-primary"
            disabled={!courses.length || loading || failed}
            onClick={() => {
              setForm({ assessment: null })
              setError(null)
              setMessage(null)
            }}
          >
            Thêm điểm
          </button>
        </div>
        {loading ? (
          <p role="status">Đang mở điểm của bạn…</p>
        ) : failed ? (
          <div>
            <p role="alert">Chưa tải được điểm. Bạn thử lại nhé.</p>
            <button onClick={() => setVersion((v) => v + 1)}>Thử lại</button>
          </div>
        ) : (
          data && (
            <>
              {message && (
                <p role="status" className="study-success">
                  {message}
                </p>
              )}
              {error && <p role="alert">{error}</p>}
              {form && (
                <AssessmentForm
                  key={form.assessment?.id ?? 'new'}
                  assessment={form.assessment}
                  courses={courses}
                  defaultCourse={course}
                  onClose={() => setForm(null)}
                  onSaved={saved}
                />
              )}
              {remove && (
                <section
                  role="dialog"
                  aria-label="Xác nhận xóa điểm"
                  className="study-form"
                >
                  <p>
                    Xóa bài “{remove.title}”? Thao tác này không thể hoàn tác.
                  </p>
                  <div className="study-actions">
                    <button disabled={pending} onClick={() => setRemove(null)}>
                      Giữ lại
                    </button>
                    <button
                      disabled={pending}
                      onClick={() => void confirmDelete()}
                    >
                      Đồng ý xóa
                    </button>
                  </div>
                </section>
              )}
              <section aria-label="Tổng quan điểm" className="grades-summaries">
                {data.summaries.map((s) => (
                  <article
                    className="study-card grade-summary"
                    key={s.courseId}
                  >
                    <h2>{s.courseName}</h2>
                    <p>
                      {s.assessmentCount} bài · {s.numericCount} bài có điểm số
                    </p>
                    <p>
                      {s.averagePercent === null
                        ? 'Chưa có trung bình điểm số'
                        : `Trung bình điểm số: ${gradeNumber(s.averagePercent)}%`}
                    </p>
                    {s.latestAssessment && (
                      <p>
                        Gần nhất: {s.latestAssessment.title} ·{' '}
                        {gradeScore(s.latestAssessment)}
                      </p>
                    )}
                    {s.weightState === 'NONE' ? (
                      <p className="study-muted">
                        Chưa có điểm kèm trọng số để tổng hợp.
                      </p>
                    ) : s.weightState === 'OVERALLOCATED' ? (
                      <p className="study-muted">
                        Tổng trọng số có điểm vượt 100% (
                        {gradeNumber(s.weightedCoveragePercent)}%). Bạn kiểm tra
                        lại trọng số nhé.
                      </p>
                    ) : (
                      <>
                        <p>
                          Điểm quy đổi theo trọng số:{' '}
                          {gradeNumber(s.weightedEarnedPercent!)} điểm phần trăm
                        </p>
                        <p className="study-muted">
                          Đã có điểm cho{' '}
                          {gradeNumber(s.weightedCoveragePercent)}% trọng số.{' '}
                          {s.weightState === 'INCOMPLETE'
                            ? 'Chưa đủ trọng số — chưa phải điểm cuối môn.'
                            : 'Đủ 100% trọng số đã nhập; đây không phải kết luận điểm cuối môn.'}
                        </p>
                      </>
                    )}
                  </article>
                ))}
              </section>
              {data.assessments.length ? (
                <section aria-label="Các bài của bạn" className="grades-list">
                  {data.assessments.map((a) => (
                    <article className="study-card grade-assessment" key={a.id}>
                      <div className="study-heading">
                        <h2>{a.title}</h2>
                        <span className="grade-type">
                          {ASSESSMENT_LABELS[a.assessmentType]}
                        </span>
                      </div>
                      <p>{courses.find((c) => c.id === a.courseId)?.name}</p>
                      <p className="grade-score">
                        {gradeScore(a)}
                        {a.percentage !== null
                          ? ` · ${gradeNumber(a.percentage)}%`
                          : ''}
                      </p>
                      {a.letterGrade && a.score !== null && (
                        <p>Điểm chữ: {a.letterGrade}</p>
                      )}
                      {a.weightPercent !== null && (
                        <p>Trọng số: {gradeNumber(a.weightPercent)}%</p>
                      )}
                      {a.assessedAt && (
                        <time dateTime={a.assessedAt}>
                          {gradeDate(a.assessedAt)}
                        </time>
                      )}
                      {a.note && <p className="study-note">{a.note}</p>}
                      <AssessmentSharing assessmentId={a.id} title={a.title} />
                      <div className="study-actions">
                        <button
                          aria-label={`Chỉnh sửa ${a.title}`}
                          onClick={() => {
                            setForm({ assessment: a })
                            setError(null)
                            setMessage(null)
                          }}
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          aria-label={`Xóa ${a.title}`}
                          onClick={() => setRemove(a)}
                        >
                          Xóa
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              ) : (
                <div className="study-card">
                  <h2>Chưa có điểm nào</h2>
                  <p>
                    Khi bạn thêm bài kiểm tra hoặc bài tập, kết quả sẽ xuất hiện
                    ở đây.
                  </p>
                  {!courses.length && (
                    <p>Bạn thêm môn trong Quản lý môn học trước nhé.</p>
                  )}
                </div>
              )}
              <p className="study-muted">
                Trung bình là trung bình các phần trăm có điểm số. Trọng số chỉ
                tính bài có cả điểm số và trọng số hợp lệ; bài chưa có điểm và
                điểm chữ không được quy đổi. Không tính GPA hay điểm cuối môn.
              </p>
            </>
          )
        )}
      </section>
    </div>
  )
}
