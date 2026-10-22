import type {
  FitnessKind,
  FitnessRecord,
  FitnessWorkspace,
  FitnessPlan,
} from './fitness-api'
import {
  fitnessRecordName,
  fitnessDate,
  fitnessDuration,
  FITNESS_WEEKDAYS,
} from './fitness-display'
export function FitnessRecords({
  kind,
  items,
  data,
  pending,
  onEdit,
  onRemove,
  onActivate,
}: {
  kind: FitnessKind
  items: FitnessRecord[]
  data: FitnessWorkspace
  pending: boolean
  onEdit: (kind: FitnessKind, record: FitnessRecord) => void
  onRemove: (kind: FitnessKind, record: FitnessRecord) => void
  onActivate: (plan: FitnessPlan) => void
}) {
  return items.length ? (
    <ul className="fitness-records">
      {items.map((row) => (
        <li key={row.id}>
          <h4>{fitnessRecordName(row)}</h4>
          {'isActive' in row && 'name' in row && (
            <p>{row.isActive ? 'Đang dùng' : 'Đang nghỉ'}</p>
          )}
          {'weekday' in row && (
            <p>
              {FITNESS_WEEKDAYS[row.weekday - 1]} ·{' '}
              {data.plans.find((p) => p.id === row.planId)?.name}
            </p>
          )}
          {'performedAt' in row && (
            <p>
              {fitnessDate(row.performedAt)} ·{' '}
              {row.durationMinutes === null
                ? 'Chưa ghi thời lượng'
                : fitnessDuration(row.durationMinutes)}
            </p>
          )}
          {'note' in row && row.note && (
            <p className="fitness-note">{row.note}</p>
          )}
          <div className="fitness-actions">
            {'isActive' in row && 'name' in row && !row.isActive && (
              <button disabled={pending} onClick={() => onActivate(row)}>
                Dùng kế hoạch này
              </button>
            )}
            <button
              disabled={pending}
              aria-label={`Sửa ${fitnessRecordName(row)}`}
              onClick={() => onEdit(kind, row)}
            >
              Sửa
            </button>
            <button
              disabled={pending}
              aria-label={`Xóa ${fitnessRecordName(row)}`}
              onClick={() => onRemove(kind, row)}
            >
              Xóa
            </button>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p className="fitness-muted">
      Chưa có mục nào. Bạn bắt đầu khi sẵn sàng nhé.
    </p>
  )
}
