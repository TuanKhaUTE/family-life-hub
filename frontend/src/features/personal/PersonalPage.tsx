import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import '../expenses/expenses.css'
import { ReceivedShares } from '../sharing/ReceivedShares'
import { ProfileSettings } from './ProfileSettings'
import { PinSettings } from './PinSettings'
import { InstallHelp } from './InstallHelp'
import './personal.css'
export function PersonalPage({
  profile,
  onExpenses,
  onProfileUpdated,
  onSessionEnded,
  onStudy,
  onKitchen,
  onSharing,
}: {
  profile: FamilyProfile
  onExpenses: () => void
  onProfileUpdated?: (p: FamilyProfile) => void
  onSessionEnded?: () => void
  onStudy?: () => void
  onKitchen?: () => void
  onSharing?: () => void
}) {
  return (
    <section className="personal-page">
      <header className="expense-hero">
        <ProfileAvatar profile={profile} />
        <h1>Cá nhân</h1>
        <p>{profile.displayName}, đây là không gian dành riêng cho bạn.</p>
      </header>
      <ProfileSettings profile={profile} onUpdated={onProfileUpdated} />
      <PinSettings onSessionEnded={onSessionEnded} />
      <InstallHelp />
      <section className="expense-card personal-privacy">
        <h2>Quyền riêng tư</h2>
        <p>
          Dữ liệu Học tập, Rèn luyện, Thể trạng và Chi tiêu cá nhân mặc định là
          riêng tư.
        </p>
        <p>
          Chỉ từng bài kiểm tra được bạn chủ động chia sẻ mới hiển thị cho người
          nhận. Chưa có chia sẻ toàn bộ mô-đun, Rèn luyện, Thể trạng hay Chi
          tiêu cá nhân.
        </p>
        {profile.role !== 'PARENT' && (
          <button onClick={onSharing}>Quản lý chia sẻ bài kiểm tra</button>
        )}
        <a href="#personal-received">Xem nội dung được chia sẻ với bạn</a>
      </section>
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
        <button
          className="personal-shortcut"
          onClick={profile.role === 'PARENT' ? onKitchen : onStudy}
        >
          {profile.role === 'PARENT' ? 'Vào bếp nhà mình' : 'Mở Học & Luyện'}
        </button>
      </section>
      <div id="personal-received">
        <ReceivedShares />
      </div>
      {profile.role === 'ADMIN' && <PinSettings admin />}
    </section>
  )
}
