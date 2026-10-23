import type { WellnessWorkspace, WeightTrend } from './wellness-api'
import {
  wellnessNumber,
  wellnessChange,
  wellnessDate,
} from './wellness-display'

export function WellnessSummary({ data }: { data: WellnessWorkspace }) {
  const s = data.summary
  return (
    <>
      <section className="wellness-metrics" aria-label="Tổng quan thể trạng">
        <div>
          <h4>Cân nặng hiện tại</h4>
          <p className="wellness-value">
            {s.currentWeightKg === null
              ? 'Chưa ghi cân nặng'
              : `${wellnessNumber(s.currentWeightKg)} kg`}
          </p>
          {s.currentLoggedDate && (
            <p>Lần cân {wellnessDate(s.currentLoggedDate)}</p>
          )}
        </div>
        <div>
          <h4>Mục tiêu</h4>
          <p className="wellness-value">
            {data.profile?.targetWeightKg == null
              ? 'Chưa đặt mục tiêu'
              : `${wellnessNumber(data.profile.targetWeightKg)} kg`}
          </p>
          <p>Bạn tự chọn, có thể bỏ trống.</p>
        </div>
        <div>
          <h4>Thay đổi gần đây</h4>
          <p className="wellness-value">
            {s.changeKg === null
              ? 'Chưa đủ lần cân'
              : wellnessChange(s.changeKg)}
          </p>
          {s.previousWeightKg !== null && s.previousLoggedDate && (
            <p>
              So với {wellnessNumber(s.previousWeightKg)} kg ·{' '}
              {wellnessDate(s.previousLoggedDate)}
            </p>
          )}
        </div>
        <div>
          <h4>BMI tham khảo</h4>
          <p className="wellness-value">
            {s.bmi === null ? 'Chưa đủ thông tin' : wellnessNumber(s.bmi)}
          </p>
          {s.bmi === null ? (
            <p>Thêm chiều cao và lần cân để xem tham khảo.</p>
          ) : (
            <p>
              Từ chiều cao đã lưu và lần cân mới nhất; không phân loại hay chấm
              điểm.
            </p>
          )}
        </div>
      </section>
      <section className="wellness-trends" aria-label="Diễn biến cân nặng">
        <h4>Diễn biến cân nặng</h4>
        <p>
          So sánh lần đầu và lần cuối thực có trong từng khoảng, không nội suy
          những ngày chưa cân.
        </p>
        <Trend label="7 ngày gần đây" value={s.trend7} />
        <Trend label="30 ngày gần đây" value={s.trend30} />
      </section>
      <p className="wellness-hint">
        Các con số chỉ để tham khảo, không phải đánh giá sức khỏe hay khuyến
        nghị y tế. Bỏ trống mục tiêu cũng hoàn toàn được.
      </p>
    </>
  )
}
function Trend({ label, value }: { label: string; value: WeightTrend | null }) {
  return (
    <div className="wellness-trend">
      <h5>{label}</h5>
      {value ? (
        <>
          <p>
            {wellnessChange(value.changeKg)} · {value.pointCount} lần cân
          </p>
          <p>
            {wellnessDate(value.fromDate)} → {wellnessDate(value.toDate)}
          </p>
        </>
      ) : (
        <p>Cần ít nhất hai lần cân trong khoảng này.</p>
      )}
    </div>
  )
}
