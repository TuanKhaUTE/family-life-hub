import { useEffect, useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import {
  fetchStudy,
  saveStudy,
  deleteStudy,
  studyError,
  type StudyWorkspace,
  type StudyRecord,
  type StudyKind,
} from './study-api'
import { StudyForm } from './StudyForm'
import { StudyProgress, studyDuration } from './StudyProgress'
import { StudyRecords, recordName } from './StudyRecords'
import { StudyGrades } from './StudyGrades'
import { FitnessSection } from '../fitness/FitnessSection'
import { ActivityPlans } from '../activities/ActivityPlans'
import { PracticeScores } from './PracticeScores'
import { AppIcon } from '../../ui/AppIcon'
import { StudyIllustration } from '../../ui/Illustration'
import { StudyOverview } from './StudyOverview'
import './study.css'
export function StudyPage({ profile }: { profile: FamilyProfile }) {
  return profile.role === 'PARENT' ? (
    <p>Đây là góc học tập riêng của mỗi bạn.</p>
  ) : (
    <MemberStudyPage />
  )
}
function MemberStudyPage() {
  const [gradesOpen, setGradesOpen] = useState(false)
  const [tab, setTab] = useState<'overview' | 'study' | 'fitness'>('study')
  const [data, setData] = useState<StudyWorkspace | null>(null),
    [state, setState] = useState<'loading' | 'ready' | 'error'>('loading'),
    [version, setVersion] = useState(0),
    [form, setForm] = useState<{
      kind: StudyKind
      record: StudyRecord | null
    } | null>(null),
    [manage, setManage] = useState(false),
    [message, setMessage] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [pending, setPending] = useState(false),
    [remove, setRemove] = useState<{
      kind: StudyKind
      record: StudyRecord
    } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetchStudy(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setData(data)
          setState('ready')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error')
      })
    return () => controller.abort()
  }, [version])
  function reload() {
    setState('loading')
    setVersion((v) => v + 1)
  }
  function saved() {
    setForm(null)
    setMessage('Đã lưu vào góc học tập của bạn.')
    reload()
  }
  function edit(kind: StudyKind, record: StudyRecord | null) {
    setForm({ kind, record })
    setError(null)
    setMessage(null)
  }
  async function action(task: () => Promise<void>, text: string) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await task()
      setMessage(text)
      setRemove(null)
      reload()
    } catch (error) {
      setError(studyError(error))
    } finally {
      setPending(false)
    }
  }
  function complete(id: string) {
    const goal = data?.goals.find((g) => g.id === id)
    if (goal) {
      const { id: ignored, ...input } = goal
      void ignored
      void action(
        () => saveStudy('goals', id, { ...input, status: 'COMPLETED' }),
        'Một mục tiêu đã hoàn thành. Bạn đã rất cố gắng 💚',
      )
    }
  }
  if (gradesOpen) return <StudyGrades onClose={() => setGradesOpen(false)} />
  return (
    <div className="study-page">
      <header className="study-hero">
        <div className="study-hero-copy">
          <p className="eyebrow">Mỗi ngày một chút 📚</p>
          <h1>Học tập &amp; Rèn luyện</h1>
          <p>Góc riêng của bạn — học theo nhịp của mình.</p>
        </div>
        <div className="study-hero-art"><StudyIllustration /></div>
      </header>
      <div className="study-tabs" role="tablist" aria-label="Góc Học và Luyện">
        {([
          ['overview', 'Tổng quan'],
          ['study', 'Học tập'],
          ['fitness', 'Rèn luyện'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`study-panel-${value}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        data ? (
          <StudyOverview study={data} />
        ) : (
          <p className="study-overview-message" role="status">Đang mở Tổng quan…</p>
        )
      )}
      {tab === 'study' && (
      <section id="study-panel-study" className="study-section" aria-labelledby="study-title">
        <h2 id="study-title" className="feature-section-title">
          <span className="icon-well"><AppIcon name="study" size={20} /></span>
          Học tập
        </h2>
        <p className="study-muted">
          Chỉ bạn xem và quản lý dữ liệu học tập của mình.
        </p>
        {state === 'loading' && <p role="status">Đang mở góc học tập…</p>}
        {state === 'error' && (
          <div>
            <p role="alert">Chưa tải được góc học tập. Bạn thử lại nhé.</p>
            <button onClick={reload}>Thử lại</button>
          </div>
        )}
        {state === 'ready' && data && (
          <>
            <ActivityPlans kind="STUDY" courses={data.courses} onChanged={reload} />
            <p className="study-muted">Bên dưới là mục tiêu và phần ghi bổ sung cho buổi đã học thực tế. Lên lịch chưa hoàn thành không cộng giờ học.</p>
            <div className="study-actions">
              <button
                className="study-primary"
                onClick={() => edit('sessions', null)}
              >
                Ghi buổi học
              </button>
              <button onClick={() => edit('goals', null)}>Thêm mục tiêu</button>
              <button onClick={() => setManage((v) => !v)}>
                Quản lý môn học
              </button>
            </div>
            {message && (
              <p role="status" className="study-success">
                {message}
              </p>
            )}
            {error && <p role="alert">{error}</p>}
            {form && (
              <StudyForm
                key={`${form.kind}:${form.record?.id ?? 'new'}`}
                kind={form.kind}
                record={form.record}
                data={data}
                onClose={() => setForm(null)}
                onSaved={saved}
              />
            )}
            {remove && (
              <section
                role="dialog"
                aria-label="Xác nhận xóa"
                className="study-form"
              >
                <p>
                  Xóa {recordName(remove.record)}? Thao tác này không thể hoàn
                  tác.
                </p>
                <button disabled={pending} onClick={() => setRemove(null)}>
                  Giữ lại
                </button>
                <button
                  disabled={pending}
                  onClick={() =>
                    void action(
                      () => deleteStudy(remove.kind, remove.record.id),
                      'Đã xóa mục bạn chọn.',
                    )
                  }
                >
                  Đồng ý xóa
                </button>
              </section>
            )}
            <div className="study-summary-grid">
            <section className="study-card" aria-label="Thời gian học tuần này">
              <h3 className="study-card-heading"><span className="icon-well"><AppIcon name="study" size={18} /></span>Thời gian học tuần này</h3>
              <StudyProgress summary={data.summary} />
              <p className="study-muted">
                Tuần tính từ thứ Hai đến Chủ nhật, theo giờ gia đình.
              </p>
            </section>
            <section className="study-card" aria-label="Thời gian theo môn">
              <h3 className="study-card-heading"><span className="icon-well"><AppIcon name="study" size={18} /></span>Thời gian theo môn</h3>
              {data.summary.courses.length ? (
                <ul className="study-breakdown">
                  {data.summary.courses.map((c) => (
                    <li key={c.courseId ?? 'self'}>
                      <span>
                        {c.name} — {studyDuration(c.minutes)}
                      </span>
                      <progress
                        aria-label={`Thời gian ${c.name}`}
                        max={Math.max(data.summary.totalMinutes, 1)}
                        value={c.minutes}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="study-muted">
                  Thêm buổi học để thấy thời gian theo từng môn.
                </p>
              )}
            </section>
            </div>
            <section className={`study-card${data.goals.length ? '' : ' study-card-empty'}`}>
              <h3>Mục tiêu của bạn</h3>
              <StudyRecords
                kind="goals"
                items={data.goals}
                data={data}
                pending={pending}
                onEdit={edit}
                onDelete={(kind, record) => setRemove({ kind, record })}
                onComplete={complete}
              />
            </section>
            <section className={`study-card${data.sessions.length ? '' : ' study-card-empty'}`}>
              <h3>Buổi học gần đây</h3>
              <StudyRecords
                kind="sessions"
                items={data.sessions}
                data={data}
                pending={pending}
                onEdit={edit}
                onDelete={(kind, record) => setRemove({ kind, record })}
                onComplete={complete}
              />
              <p className="study-muted">
                Hiển thị tối đa 50 buổi gần nhất. Tổng tuần vẫn tính tất cả buổi
                học.
              </p>
            </section>
            <PracticeScores
              courseIds={data.courses.map((course) => course.id)}
              sessionIds={data.sessions.filter((session) => session.courseId !== null).map((session) => session.id)}
            />
            <section className={`study-card${data.courses.filter((c) =>
              data.semesters.some((s) => s.id === c.semesterId && s.isActive),
            ).length ? '' : ' study-card-empty'}`}>
              <h3>Môn đang học</h3>
              {data.courses.filter((c) =>
                data.semesters.some((s) => s.id === c.semesterId && s.isActive),
              ).length ? (
                <ul>
                  {data.courses
                    .filter((c) =>
                      data.semesters.some(
                        (s) => s.id === c.semesterId && s.isActive,
                      ),
                    )
                    .map((c) => (
                      <li key={c.id}>{c.name}</li>
                    ))}
                </ul>
              ) : (
                <p className="study-muted">
                  Chưa có môn trong học kỳ đang học.
                </p>
              )}
            </section>
            <section className="study-card grades-entry">
              <h3>Điểm môn học</h3>
              <p className="study-muted">
                Xem lại kết quả từng môn trong góc riêng của bạn.
              </p>
              <button onClick={() => setGradesOpen(true)}>Xem điểm môn học</button>
            </section>
            {manage && (
              <section className="study-card" aria-label="Quản lý môn học">
                <h3>Học kỳ và môn học</h3>
                <div className="study-actions">
                  <button onClick={() => edit('semesters', null)}>
                    Thêm học kỳ
                  </button>
                  <button onClick={() => edit('courses', null)}>
                    Thêm môn học
                  </button>
                </div>
                <h4>Học kỳ của bạn</h4>
                <StudyRecords
                  kind="semesters"
                  items={data.semesters}
                  data={data}
                  pending={pending}
                  onEdit={edit}
                  onDelete={(kind, record) => setRemove({ kind, record })}
                  onComplete={complete}
                />
                <h4>Môn học của bạn</h4>
                <StudyRecords
                  kind="courses"
                  items={data.courses}
                  data={data}
                  pending={pending}
                  onEdit={edit}
                  onDelete={(kind, record) => setRemove({ kind, record })}
                  onComplete={complete}
                />
              </section>
            )}
            <section className="study-cross-link" aria-label="Rèn luyện">
              <div>
                <p className="eyebrow">Tiếp theo</p>
                <h3>Rèn luyện</h3>
                <p className="study-muted">Ghi buổi tập và xem kế hoạch vận động riêng của bạn.</p>
              </div>
              <button className="study-primary" onClick={() => setTab('fitness')}>Ghi buổi tập</button>
            </section>
          </>
        )}
      </section>
      )}
      {tab === 'fitness' && <FitnessSection />}
    </div>
  )
}
