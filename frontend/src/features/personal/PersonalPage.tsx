import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import '../expenses/expenses.css'
import { ReceivedShares } from '../sharing/ReceivedShares'
export function PersonalPage({
  profile,
  onExpenses,
}: {
  profile: FamilyProfile
  onExpenses: () => void
}) {
  return (
    <section className="personal-page">
      <header className="expense-hero">
        <ProfileAvatar profile={profile} />
        <h1>Góc của bạn</h1>
        <p>{profile.displayName}, đây là không gian dành riêng cho bạn.</p>
      </header>
      <section className="expense-card">
        <h2>Chi tiêu cá nhân</h2>
        <p>
          Ghi lại và xem các khoản chi của chính bạn. Không chia sẻ với thành
          viên khác.
        </p>
        <p>
          Trong Chi tiêu, bạn cũng có thể xem tiền ăn chung ở tab Tiền ăn gia
          đình. Các khoản cá nhân vẫn chỉ của riêng bạn.
        </p>
        <button className="expense-primary" onClick={onExpenses}>
          Mở chi tiêu cá nhân
        </button>
      </section>
      <ReceivedShares />
    </section>
  )
}
