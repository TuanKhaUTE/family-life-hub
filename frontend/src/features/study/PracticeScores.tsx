import { useEffect, useState } from 'react'
import {
  deletePractice,
  fetchPractice,
  savePractice,
  togglePractice,
  type PracticeView,
  type StudySession,
} from './study-api'

type PracticeSession = Pick<StudySession, 'id' | 'courseId' | 'studiedAt'>

export function PracticeScores({
  courseIds,
  sessions,
}: {
  courseIds: string[]
  sessions: PracticeSession[]
}) {
  const [data, setData] = useState<PracticeView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<{
    sessionId: string
    metricTitle: string
    score: string
    maxScore: string
    note: string
  }>({
    sessionId: sessions[0]?.id ?? '',
    metricTitle: '',
    score: '',
    maxScore: '',
    note: '',
  })
  const [pending, setPending] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({})
  const load = () => {
    const controller = new AbortController()
    void fetchPractice(null, controller.signal)
      .then(setData)
      .catch(() => setError('Chưa tải được điểm luyện tập. Bạn thử lại nhé.'))
    return () => controller.abort()
  }
  useEffect(load, [])
  const visibleCourses = data?.courses.filter((course) =>
    courseIds.includes(course.id),
  )
  const enabledCourseIds = new Set(
    visibleCourses
      ?.filter((course) => course.practiceTracking)
      .map((course) => course.id),
  )
  const eligibleSessions = sessions.filter(
    (session) =>
      session.courseId !== null && enabledCourseIds.has(session.courseId),
  )
  const selectedSessionId = eligibleSessions.some(
    (session) => session.id === form.sessionId,
  )
    ? form.sessionId
    : eligibleSessions[0]?.id ?? ''
  async function submit() {
    if (pending || !selectedSessionId) return
    setPending(true); setError(null)
    try {
      await savePractice(null, {
        sessionId: selectedSessionId,
        metricTitle: form.metricTitle,
        score: Number(form.score),
        maxScore: Number(form.maxScore),
        note: form.note || null,
      })
      setForm((v) => ({ ...v, metricTitle: '', score: '', maxScore: '', note: '' }))
      load()
    }
    catch { setError('Bạn kiểm tra buổi học, tên chỉ số và điểm số nhé.') }
    finally { setPending(false) }
  }
  if (!data) return <p className="study-muted" role="status">Đang mở điểm luyện tập…</p>
  return <section className="study-card practice-scores" aria-label="Điểm luyện tập">
    <h3>Điểm luyện tập</h3>
    <p className="study-muted">Theo dõi điểm lặp lại riêng, không trộn với điểm môn học.</p>
    {visibleCourses?.map((course) => <button key={course.id} type="button" onClick={() => { void togglePractice(course.id, !course.practiceTracking).then(load).catch(() => setError('Chưa thể đổi cài đặt môn học.')) }}>{course.practiceTracking ? 'Tắt' : 'Bật'} Theo dõi điểm luyện tập · {course.name}</button>)}
    {eligibleSessions.length > 0 ? <div className="practice-entry practice-entry-form">
      <h4>Thêm kết quả cho buổi học đã hoàn thành</h4>
      <div className="practice-entry-fields">
        <label className="practice-field">Buổi học<select value={selectedSessionId} onChange={(e) => setForm({ ...form, sessionId: e.target.value })}>{eligibleSessions.map((session) => <option key={session.id} value={session.id}>{data.courses.find((course) => course.id === session.courseId)?.name ?? 'Buổi học'} · {session.studiedAt}</option>)}</select></label>
        <label className="practice-field">Chỉ số / tên bài<input value={form.metricTitle} onChange={(e) => setForm({ ...form, metricTitle: e.target.value })} /></label>
        <label className="practice-field">Điểm đạt được<input type="number" min="0" step="0.0001" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></label>
        <label className="practice-field">Điểm tối đa<input type="number" min="0.0001" step="0.0001" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} /></label>
        <label className="practice-field practice-field-note">Ghi chú (không bắt buộc)<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
      </div>
      <div className="practice-entry-actions"><button className="study-primary" disabled={pending} onClick={() => void submit()}>Lưu điểm luyện tập</button></div>
    </div> : <p className="study-muted practice-entry-hint">Chưa có buổi học đủ điều kiện để ghi điểm luyện tập.</p>}
    {error && <p role="alert">{error}</p>}
    {data.trends.map((trend) => {
      const expanded = expandedHistory[trend.courseId] === true
      const visibleHistory = expanded ? trend.history : trend.history.slice(-3)
      return <article key={trend.courseId}><h4>{trend.courseName}</h4><p>Gần nhất: {trend.latest ? `${trend.latest.metricTitle} · ${trend.latest.score}/${trend.latest.maxScore}` : 'Chưa có kết quả'}</p>{trend.previous && <p>Thay đổi: {trend.changePercentagePoints === null ? 'Chưa đủ dữ liệu' : `${trend.changePercentagePoints > 0 ? '+' : ''}${trend.changePercentagePoints}%`}</p>}<p className="study-muted">Tuần này: {trend.thisWeekAverage === null ? '—' : `${trend.thisWeekAverage}%`} · Tháng này: {trend.thisMonthAverage === null ? '—' : `${trend.thisMonthAverage}%`}</p><ul>{visibleHistory.map((item) => <li key={item.id}>{item.studiedAt} · {item.metricTitle}: {item.score}/{item.maxScore}<button type="button" onClick={() => { void deletePractice(item.id).then(load).catch(() => setError('Chưa thể xóa kết quả.')) }}>Xóa</button></li>)}</ul>{trend.history.length > 3 && <button type="button" onClick={() => setExpandedHistory((current) => ({ ...current, [trend.courseId]: !expanded }))}>{expanded ? 'Thu gọn kết quả' : 'Xem thêm kết quả'}</button>}</article>
    })}
  </section>
}
