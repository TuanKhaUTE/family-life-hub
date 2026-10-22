import { useEffect, useState } from 'react'
import { ProfileAvatar } from '../auth/ProfileSelector'
import {
  gradeDate,
  gradeNumber,
  gradeScore,
  ASSESSMENT_LABELS,
} from '../study/grade-display'
import { fetchReceivedShares, type ReceivedSharesView } from './share-api'
import './sharing.css'
export function ReceivedShares() {
  const [data, setData] = useState<ReceivedSharesView | null>(null),
    [state, setState] = useState('loading'),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0)
  useEffect(() => {
    const c = new AbortController()
    void fetchReceivedShares(page, c.signal)
      .then((d) => {
        if (!c.signal.aborted) {
          setData(d)
          setState('ready')
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setState('error')
      })
    return () => c.abort()
  }, [page, version])
  function refresh() {
    setState('loading')
    setVersion((v) => v + 1)
  }
  return (
    <section className="received-shares" aria-label="Được chia sẻ với bạn">
      <header>
        <h2>Được chia sẻ với bạn</h2>
        <p>
          Chỉ những kết quả người thân chủ động chia sẻ. Các góc riêng khác vẫn
          riêng tư.
        </p>
        <button onClick={refresh}>Làm mới chia sẻ</button>
      </header>
      {state === 'loading' && (
        <p role="status">Đang mở những chia sẻ dành cho bạn…</p>
      )}
      {state === 'error' && (
        <>
          <p role="alert">Chưa xem được chia sẻ. Bạn thử lại nhé.</p>
          <button onClick={refresh}>Thử lại</button>
        </>
      )}
      {state === 'ready' && data && (
        <>
          {data.records.length === 0 && (
            <p>Chưa có kết quả nào được chia sẻ với bạn.</p>
          )}
          <ul className="share-cards">
            {data.records.map((r) => (
              <li className="received-share" key={r.id}>
                <div className="share-owner">
                  <ProfileAvatar profile={r.owner} />
                  <strong>{r.owner.displayName}</strong>
                </div>
                <h3>
                  {r.assessment.courseName} · {r.assessment.title}
                </h3>
                <p className="shared-score">
                  {gradeScore(r.assessment)}
                  {r.assessment.percentage !== null
                    ? ' · ' + gradeNumber(r.assessment.percentage) + '%'
                    : ''}
                </p>
                <p>{ASSESSMENT_LABELS[r.assessment.assessmentType]}</p>
                {r.assessment.letterGrade && r.assessment.score !== null && (
                  <p>Điểm chữ: {r.assessment.letterGrade}</p>
                )}
                {r.assessment.assessedAt && (
                  <p>
                    Ngày đánh giá:{' '}
                    <time dateTime={r.assessment.assessedAt}>
                      {gradeDate(r.assessment.assessedAt)}
                    </time>
                  </p>
                )}
                <p className="share-muted">
                  Được {r.owner.displayName} chia sẻ
                </p>
                <p className="share-muted">
                  Chia sẻ ngày{' '}
                  {new Intl.DateTimeFormat('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    dateStyle: 'short',
                  }).format(new Date(r.sharedAt))}{' '}
                  · Chỉ xem
                </p>
              </li>
            ))}
          </ul>
          <div className="share-pages">
            {page > 1 && (
              <button
                onClick={() => {
                  setState('loading')
                  setPage((p) => p - 1)
                }}
              >
                Trang trước
              </button>
            )}
            {data.hasMore && (
              <button
                onClick={() => {
                  setState('loading')
                  setPage((p) => p + 1)
                }}
              >
                Trang sau
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
