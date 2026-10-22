import { useEffect, useState, type FormEvent } from 'react'
import { fetchActivities, saveActivity, completeActivity, cancelActivity, activityError, type ActivityKind, type ActivityPlan, type ActivityView } from './activity-api'
import { ActivityStatistics } from './ActivityStatistics'
import { familyDate, localInputToUtc, toLocalDateTimeInput } from '../meals/family-time'
import { useFamilyClock } from '../meals/use-family-clock'
import { calendarDay, calendarTime, shiftDay } from '../calendar/calendar-time'
import './activities.css'
export function ActivityPlans({ kind, courses = [], planId, onChanged }: { kind: ActivityKind; courses?: { id: string; name: string }[]; planId?: string; onChanged?: () => void }) {
  const [data, setData] = useState<ActivityView | null>(null), [state, setState] = useState<'loading'|'ready'|'error'>('loading'), [version, setVersion] = useState(0), [form, setForm] = useState<ActivityPlan | 'new' | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetchActivities(kind, controller.signal, planId).then(value => { if (!controller.signal.aborted) { setData(value); setState('ready') } }).catch(() => { if (!controller.signal.aborted) setState('error') })
    return () => controller.abort()
  }, [kind, version, planId])
  function refresh() { setForm(null); setState('loading'); setVersion(v => v + 1); onChanged?.() }
  return <section className="activity-plans" aria-label={kind === 'STUDY' ? 'Kế hoạch học tập' : 'Kế hoạch buổi tập'}>
    <h3>{kind === 'STUDY' ? 'Hẹn một buổi học cho mình' : 'Hẹn một buổi tập cho mình'}</h3>
    <p className="activity-hint">Lên lịch → Hoàn thành → Tiến bộ. Kế hoạch nằm trong Lịch của tôi, không hiện ở Lịch nhà.</p>
    {state === 'loading' && <p role="status">Đang mở kế hoạch của bạn…</p>}
    {state === 'error' && <><p role="alert">Chưa tải được kế hoạch. Bạn thử lại nhé.</p><button onClick={() => { setState('loading'); setVersion(v => v + 1) }}>Tải lại kế hoạch</button></>}
    {state === 'ready' && data && <>
      {!planId && <><ActivityStatistics progress={data.progress} study={kind === 'STUDY'} /><button className="activity-primary" onClick={() => setForm('new')}>{kind === 'STUDY' ? 'Lên lịch buổi học' : 'Lên lịch buổi tập'}</button></>}
      {form && <ActivityForm key={typeof form === 'string' ? 'new' : form.id} kind={kind} plan={form === 'new' ? null : form} courses={courses} onSaved={refresh} onClose={() => setForm(null)} />}
      {!data.plans.length && <p>Chưa có buổi nào được lên lịch.</p>}
      <div className="activity-list">{data.plans.filter(p => !p.cancelled).map(plan => <PlannedActivity key={plan.id + (plan.actualMinutes ?? '')} plan={plan} onEdit={() => setForm(plan)} onChanged={refresh} />)}</div>
    </>}
  </section>
}
function PlannedActivity({ plan, onEdit, onChanged }: { plan: ActivityPlan; onEdit: () => void; onChanged: () => void }) {
  const now = useFamilyClock(), [completing, setCompleting] = useState(false), [minutes, setMinutes] = useState(String(plan.actualMinutes ?? Math.max(1, Math.round((Date.parse(plan.endsAt) - Date.parse(plan.startsAt)) / 60000)))), [note, setNote] = useState(plan.completionNote ?? ''), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [cancel, setCancel] = useState(false)
  const due = localInputToUtc(shiftDay(familyDate(new Date(plan.endsAt)), 1) + 'T00:00')!
  const editable = !plan.completedAt && now.getTime() < Date.parse(due)
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return
    setBusy(true); setError(null)
    try { await completeActivity(plan.id, Number(minutes), note.trim() || null, !!plan.completedAt); setCompleting(false); onChanged() } catch (error) { setError(activityError(error)) } finally { setBusy(false) }
  }
  return <article className={`activity-plan ${plan.completedAt ? 'activity-completed' : ''}`}>
    <h4>{plan.title}</h4><p>{calendarDay(familyDate(new Date(plan.startsAt)))} · {calendarTime(plan.startsAt)}–{calendarTime(plan.endsAt)}</p>
    {plan.note && <p>{plan.note}</p>}
    <p>{plan.completedAt ? `Đã hoàn thành ✓ · ${plan.actualMinutes} phút thực tế` : 'Chưa hoàn thành'}</p>
    {plan.completionNote && <p>{plan.completionNote}</p>}
    {error && <p role="alert">{error}</p>}
    {!completing && <div className="activity-actions">
      {(plan.completedAt || now.getTime() >= Date.parse(plan.startsAt)) && <button className="activity-primary" onClick={() => setCompleting(true)}>{plan.completedAt ? 'Sửa thời lượng thực tế' : plan.kind === 'STUDY' ? 'Hoàn thành buổi học' : 'Hoàn thành buổi tập'}</button>}
      {editable && <><button onClick={onEdit}>Đổi lịch</button><button onClick={() => setCancel(true)}>Hủy buổi đã hẹn</button></>}
    </div>}
    {cancel && <div><p>Hủy buổi này trước hạn? Buổi đã hủy không tính vào kế hoạch.</p><button disabled={busy} onClick={async () => { if (busy) return; setBusy(true); try { await cancelActivity(plan.id); onChanged() } catch (error) { setError(activityError(error)) } finally { setBusy(false) } }}>Xác nhận hủy buổi</button><button disabled={busy} onClick={() => setCancel(false)}>Giữ lại</button></div>}
    {completing && <form onSubmit={submit}><fieldset disabled={busy}>
      <label>Thời lượng thực tế (phút)<input type="number" min="1" max="1440" step="1" required value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
      <label>Ghi chú sau buổi (không bắt buộc)<textarea maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
      <div className="activity-actions"><button className="activity-primary">{plan.completedAt ? 'Lưu thời lượng thực tế' : 'Xác nhận hoàn thành'}</button><button type="button" onClick={() => setCompleting(false)}>Để sau</button></div>
    </fieldset></form>}
  </article>
}
function ActivityForm({ kind, plan, courses, onSaved, onClose }: { kind: ActivityKind; plan: ActivityPlan | null; courses: { id: string; name: string }[]; onSaved: () => void; onClose: () => void }) {
  const [requestId] = useState(() => plan?.id ?? crypto.randomUUID()), [title, setTitle] = useState(plan?.title ?? ''), [date, setDate] = useState(plan ? familyDate(new Date(plan.startsAt)) : familyDate()), [start, setStart] = useState(plan ? toLocalDateTimeInput(new Date(plan.startsAt)).slice(11) : '19:00'), [end, setEnd] = useState(plan ? toLocalDateTimeInput(new Date(plan.endsAt)).slice(11) : '20:00'), [course, setCourse] = useState(plan?.courseId ?? ''), [note, setNote] = useState(plan?.note ?? ''), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  return <form aria-label="Thông tin kế hoạch" onSubmit={async e => {
    e.preventDefault(); if (busy) return
    const startsAt = localInputToUtc(date + 'T' + start), endsAt = localInputToUtc(date + 'T' + end)
    if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) { setError('Bạn chọn giờ kết thúc sau giờ bắt đầu nhé.'); return }
    setBusy(true); setError(null)
    try { await saveActivity(kind, { requestId, title: title.trim(), startsAt, endsAt, courseId: kind === 'STUDY' ? course || null : null, note: note.trim() || null }, plan?.id ?? null); onSaved() } catch (error) { setError(activityError(error)) } finally { setBusy(false) }
  }}><fieldset disabled={busy}>
    <label>Tên môn / nội dung<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
    {kind === 'STUDY' && <label>Môn học (không bắt buộc)<select value={course} onChange={e => setCourse(e.target.value)}><option value="">Tự học, không gắn môn</option>{course && !courses.some(c => c.id === course) && <option value={course}>Môn học đã liên kết</option>}{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
    <label>Ngày<input type="date" min="2000-01-01" max="2199-12-31" required value={date} onChange={e => setDate(e.target.value)} /></label>
    <div className="activity-time-row"><label>Bắt đầu<input type="time" required value={start} onChange={e => setStart(e.target.value)} /></label><label>Kết thúc<input type="time" required value={end} onChange={e => setEnd(e.target.value)} /></label></div>
    <label>Ghi chú kế hoạch (không bắt buộc)<textarea maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}<div className="activity-actions"><button className="activity-primary">Lưu kế hoạch</button><button type="button" onClick={onClose}>Đóng biểu mẫu</button></div>
  </fieldset></form>
}
