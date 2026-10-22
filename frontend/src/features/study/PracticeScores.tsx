import { useEffect, useState } from 'react'
import { deletePractice, fetchPractice, savePractice, togglePractice, type PracticeView } from './study-api'

export function PracticeScores({ courseIds, sessionIds }: { courseIds: string[]; sessionIds: string[] }) {
  const [data, setData] = useState<PracticeView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<{ sessionId: string; metricTitle: string; score: string; maxScore: string; note: string }>({ sessionId: sessionIds[0] ?? '', metricTitle: '', score: '', maxScore: '', note: '' })
  const [pending, setPending] = useState(false)
  const load = () => {
    const controller = new AbortController()
    void fetchPractice(null, controller.signal).then(setData).catch(() => setError('Chưa tải được điểm luyện tập. Bạn thử lại nhé.'))
    return () => controller.abort()
  }
  useEffect(load, [])
  async function submit() {
    if (pending) return
    setPending(true); setError(null)
    try { await savePractice(null, { sessionId: form.sessionId, metricTitle: form.metricTitle, score: Number(form.score), maxScore: Number(form.maxScore), note: form.note || null }); setForm((v) => ({ ...v, metricTitle: '', score: '', maxScore: '', note: '' })); load() }
    catch { setError('Bạn kiểm tra buổi học, tên chỉ số và điểm số nhé.') }
    finally { setPending(false) }
  }
  if (!data) return <p className="study-muted" role="status">Đang mở điểm luyện tập…</p>
  const enabled = data.courses.filter((course) => course.practiceTracking && courseIds.includes(course.id))
  return <section className="study-card practice-scores" aria-label="Điểm luyện tập">
    <h3>Điểm luyện tập</h3>
    <p className="study-muted">Theo dõi điểm lặp lại riêng, không trộn với điểm môn học.</p>
    {data.courses.filter((course) => courseIds.includes(course.id)).map((course) => <button key={course.id} type="button" onClick={() => { void togglePractice(course.id, !course.practiceTracking).then(load).catch(() => setError('Chưa thể đổi cài đặt môn học.')) }}>{course.practiceTracking ? 'Tắt' : 'Bật'} Theo dõi điểm luyện tập · {course.name}</button>)}
    {enabled.length > 0 && sessionIds.length > 0 && <div className="practice-entry">
      <h4>Thêm kết quả cho buổi học đã hoàn thành</h4>
        <label>Buổi học<select value={form.sessionId} onChange={(e) => setForm({ ...form, sessionId: e.target.value })}>{sessionIds.map((id, index) => <option key={id} value={id}>Buổi học {index + 1}</option>)}</select></label>
      <label>Chỉ số / tên bài<input value={form.metricTitle} onChange={(e) => setForm({ ...form, metricTitle: e.target.value })} /></label>
      <label>Điểm đạt được<input type="number" min="0" step="0.0001" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></label>
      <label>Điểm tối đa<input type="number" min="0.0001" step="0.0001" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} /></label>
      <label>Ghi chú (không bắt buộc)<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
      <button className="study-primary" disabled={pending} onClick={() => void submit()}>Lưu điểm luyện tập</button>
    </div>}
    {error && <p role="alert">{error}</p>}
    {data.trends.map((trend) => <article key={trend.courseId}><h4>{trend.courseName}</h4><p>Gần nhất: {trend.latest ? `${trend.latest.metricTitle} · ${trend.latest.score}/${trend.latest.maxScore}` : 'Chưa có kết quả'}</p>{trend.previous && <p>Thay đổi: {trend.changePercentagePoints === null ? 'Chưa đủ dữ liệu' : `${trend.changePercentagePoints > 0 ? '+' : ''}${trend.changePercentagePoints}%`}</p>}<p className="study-muted">Tuần này: {trend.thisWeekAverage === null ? '—' : `${trend.thisWeekAverage}%`} · Tháng này: {trend.thisMonthAverage === null ? '—' : `${trend.thisMonthAverage}%`}</p><ul>{trend.history.slice(-5).map((item) => <li key={item.id}>{item.studiedAt} · {item.metricTitle}: {item.score}/{item.maxScore}<button type="button" onClick={() => { void deletePractice(item.id).then(load).catch(() => setError('Chưa thể xóa kết quả.')) }}>Xóa</button></li>)}</ul></article>)}
  </section>
}
