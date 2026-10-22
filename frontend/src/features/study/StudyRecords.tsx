import type { StudyKind, StudyRecord, StudyWorkspace } from './study-api'
import { studyDuration } from './StudyProgress'
function date(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T12:00:00Z'))
}
export function recordName(item: StudyRecord) {
  return 'name' in item
    ? item.name
    : 'title' in item
      ? item.title
      : `Buổi học ${date(item.studiedAt)}`
}
export function StudyRecords({
  kind,
  items,
  data,
  pending,
  onEdit,
  onDelete,
  onComplete,
}: {
  kind: StudyKind
  items: StudyRecord[]
  data: StudyWorkspace
  pending: boolean
  onEdit: (kind: StudyKind, record: StudyRecord) => void
  onDelete: (kind: StudyKind, record: StudyRecord) => void
  onComplete: (id: string) => void
}) {
  return items.length ? (
    <ul className="study-records">
      {items.map((item) => (
        <li key={item.id}>
          <div>
            <h4>{recordName(item)}</h4>
            {'isActive' in item && (
              <p>
                {date(item.startDate)} – {date(item.endDate)}
                {item.isActive ? ' · Đang học' : ''}
              </p>
            )}
            {'semesterId' in item && (
              <p>
                {data.semesters.find((s) => s.id === item.semesterId)?.name}
                {item.code ? ` · ${item.code}` : ''}
              </p>
            )}
            {'courseId' in item && (
              <p>
                {data.courses.find((c) => c.id === item.courseId)?.name ??
                  'Không gắn môn học'}
              </p>
            )}
            {'durationMinutes' in item && (
              <>
                <p>{studyDuration(item.durationMinutes)}</p>
                {item.note && <p className="study-note">{item.note}</p>}
              </>
            )}
            {'status' in item && (
              <>
                <p>
                  {item.status === 'COMPLETED'
                    ? 'Hoàn thành ✓'
                    : 'Đang thực hiện'}
                  {item.targetDate ? ` · ${date(item.targetDate)}` : ''}
                </p>
                {item.status === 'ACTIVE' && (
                  <button
                    disabled={pending}
                    onClick={() => onComplete(item.id)}
                  >
                    Đánh dấu hoàn thành
                  </button>
                )}
              </>
            )}
          </div>
          <div className="study-actions">
            <button
              disabled={pending}
              aria-label={`Sửa ${recordName(item)}`}
              onClick={() => onEdit(kind, item)}
            >
              Sửa
            </button>
            <button
              disabled={pending}
              aria-label={`Xóa ${recordName(item)}`}
              onClick={() => onDelete(kind, item)}
            >
              Xóa
            </button>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p className="study-muted">
      Chưa có mục nào. Bạn bắt đầu khi sẵn sàng nhé.
    </p>
  )
}
