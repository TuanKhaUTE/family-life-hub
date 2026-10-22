import { useEffect, useState } from 'react'
import {
  fetchFitness,
  saveFitness,
  deleteFitness,
  fitnessError,
  type FitnessKind,
  type FitnessWorkspace,
  type FitnessRecord,
  type FitnessPlan,
} from './fitness-api'
import { FitnessForm } from './FitnessForm'
import { FitnessSummary } from './FitnessSummary'
import { FitnessRecords } from './FitnessRecords'
import {
  FITNESS_WEEKDAYS,
  fitnessDate,
  fitnessRecordName,
} from './fitness-display'
import './fitness.css'
import { WellnessSection } from '../wellness/WellnessSection'
export function FitnessSection() {
  const [data, setData] = useState<FitnessWorkspace | null>(null),
    [state, setState] = useState<'loading' | 'ready' | 'error'>('loading'),
    [version, setVersion] = useState(0),
    [manage, setManage] = useState(false),
    [history, setHistory] = useState(false),
    [form, setForm] = useState<{
      kind: FitnessKind
      record: FitnessRecord | null
    } | null>(null),
    [remove, setRemove] = useState<{
      kind: FitnessKind
      record: FitnessRecord
    } | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetchFitness(controller.signal)
      .then((view) => {
        if (!controller.signal.aborted) {
          setData(view)
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
  function edit(kind: FitnessKind, record: FitnessRecord | null) {
    setForm({ kind, record })
    setMessage(null)
    setError(null)
  }
  function saved() {
    setForm(null)
    setMessage('Đã lưu vào góc rèn luyện của bạn.')
    reload()
  }
  async function action(task: () => Promise<void>, message: string) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await task()
      setRemove(null)
      setMessage(message)
      reload()
    } catch (error) {
      setError(fitnessError(error))
    } finally {
      setPending(false)
    }
  }
  function activate(plan: FitnessPlan) {
    void action(
      () =>
        saveFitness('plans', plan.id, {
          name: plan.name,
          note: plan.note,
          isActive: true,
        }),
      'Đã đổi kế hoạch đang dùng.',
    )
  }
  const recordProps = {
    data: data!,
    pending,
    onEdit: edit,
    onRemove: (kind: FitnessKind, record: FitnessRecord) =>
      setRemove({ kind, record }),
    onActivate: activate,
  }
  return (
    <section className="fitness-section" aria-label="Rèn luyện">
      <header className="fitness-heading">
        <div>
          <p className="eyebrow">Chăm chút cho mình 🌿</p>
          <h2>Rèn luyện</h2>
        </div>
        <span aria-hidden="true">🏃</span>
      </header>
      <p className="fitness-muted">
        Góc riêng của bạn. Mỗi buổi tập là một chút quan tâm bản thân.
      </p>
      {state === 'loading' && (
        <p role="status" aria-label="Tải rèn luyện">
          Đang mở góc rèn luyện…
        </p>
      )}
      {state === 'error' && (
        <div>
          <p role="alert">Chưa tải được rèn luyện. Bạn thử lại nhé.</p>
          <button onClick={reload}>Thử lại rèn luyện</button>
        </div>
      )}
      {state === 'ready' && data && (
        <>
          <div className="fitness-actions">
            <button
              className="fitness-primary"
              onClick={() => edit('sessions', null)}
            >
              Ghi buổi tập
            </button>
            <button onClick={() => setManage((v) => !v)}>Lịch tập</button>
            <button
              onClick={() =>
                edit('goals', data.goals.find((g) => g.isActive) ?? null)
              }
            >
              Mục tiêu tuần
            </button>
          </div>
          {message && (
            <p role="status" className="fitness-success">
              {message}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          {form && (
            <FitnessForm
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
              aria-label="Xác nhận xóa rèn luyện"
              className="fitness-form"
            >
              <p>
                Xóa {fitnessRecordName(remove.record)}? Thao tác này không thể
                hoàn tác.
              </p>
              <div className="fitness-actions">
                <button disabled={pending} onClick={() => setRemove(null)}>
                  Giữ lại
                </button>
                <button
                  disabled={pending}
                  onClick={() =>
                    void action(
                      () => deleteFitness(remove.kind, remove.record.id),
                      'Đã xóa mục bạn chọn.',
                    )
                  }
                >
                  Đồng ý xóa
                </button>
              </div>
            </section>
          )}
          <section className="fitness-card" aria-label="Rèn luyện trong tuần">
            <h3>🎯 Tuần này</h3>
            <FitnessSummary summary={data.summary} />
            {data.goals.some((g) => g.isActive) && (
              <button
                disabled={pending}
                onClick={() =>
                  setRemove({
                    kind: 'goals',
                    record: data.goals.find((g) => g.isActive)!,
                  })
                }
              >
                Bỏ mục tiêu tuần
              </button>
            )}
          </section>
          <section className="fitness-card fitness-next">
            <h3>Buổi tiếp theo</h3>
            {data.summary.nextWorkout ? (
              <>
                <h4>{data.summary.nextWorkout.title}</h4>
                <p>
                  {FITNESS_WEEKDAYS[data.summary.nextWorkout.weekday - 1]} ·{' '}
                  {fitnessDate(data.summary.nextWorkout.date)}
                </p>
              </>
            ) : (
              <p className="fitness-muted">
                Chưa có buổi tập sắp tới trong kế hoạch đang dùng.
              </p>
            )}
          </section>
          <section className="fitness-card">
            <h3>Buổi tập gần đây</h3>
            <FitnessRecords
              kind="sessions"
              items={history ? data.sessions : data.sessions.slice(0, 5)}
              {...recordProps}
            />
            {data.sessions.length > 5 && (
              <button onClick={() => setHistory((v) => !v)}>
                {history ? 'Thu gọn' : 'Xem thêm buổi đã ghi'}
              </button>
            )}
            <p className="fitness-muted">
              Giữ tối đa 20 buổi gần nhất ở đây. Tổng tuần vẫn tính tất cả buổi
              tập.
            </p>
          </section>
          {manage && (
            <section className="fitness-card" aria-label="Quản lý lịch tập">
              <h3>Lịch tập của bạn</h3>
              <div className="fitness-actions">
                <button onClick={() => edit('plans', null)}>
                  Thêm kế hoạch
                </button>
                <button
                  disabled={!data.plans.length}
                  onClick={() => edit('days', null)}
                >
                  Thêm ngày tập
                </button>
              </div>
              <h4>Kế hoạch</h4>
              <FitnessRecords
                kind="plans"
                items={data.plans}
                {...recordProps}
              />
              <h4>Các ngày trong tuần</h4>
              <FitnessRecords kind="days" items={data.days} {...recordProps} />
              <p className="fitness-muted">
                Lịch tập chỉ riêng bạn xem, không tự thêm vào Lịch gia đình.
              </p>
            </section>
          )}
        </>
      )}
      <WellnessSection />
    </section>
  )
}
