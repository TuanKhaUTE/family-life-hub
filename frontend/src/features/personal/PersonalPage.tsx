import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import '../expenses/expenses.css'
import { ReceivedShares } from '../sharing/ReceivedShares'
import { ProfileSettings } from './ProfileSettings'
import { PinSettings } from './PinSettings'
import { InstallHelp } from './InstallHelp'
import { AppIcon } from '../../ui/AppIcon'
import { ProfileIllustration } from '../../ui/Illustration'
import './personal.css'
export function PersonalPage({
  profile,
  onExpenses,
  onProfileUpdated,
  onSessionEnded,
  onStudy,
  onKitchen,
  onSharing,
  onLogout,
  isLoggingOut = false,
}: {
  profile: FamilyProfile
  onExpenses: () => void
  onProfileUpdated?: (p: FamilyProfile) => void
  onSessionEnded?: () => void
  onStudy?: () => void
  onKitchen?: () => void
  onSharing?: () => void
  onLogout?: () => void
  isLoggingOut?: boolean
}) {
  return (
    <section className="personal-page">
      <header className="expense-hero">
        <div className="personal-hero-copy">
          <ProfileAvatar profile={profile} />
          <h1>Cá nhân</h1>
          <p>{profile.displayName}, đây là không gian dành riêng cho bạn.</p>
          <span className="personal-role-badge">{roleLabel(profile.role)}</span>
        </div>
        <ProfileIllustration />
      </header>
      <div className="personal-group">
        <p className="personal-group-label">Tài khoản &amp; bảo mật</p>
        <ProfileSettings profile={profile} onUpdated={onProfileUpdated} />
        <PinSettings onSessionEnded={onSessionEnded} />
      </div>
      <div className="personal-group personal-data-group">
        <p className="personal-group-label">Cá nhân hóa</p>
        <InstallHelp />
      <section className="expense-card personal-privacy">
        <h2><span className="icon-well"><AppIcon name="personal" size={18} /></span>Quyền riêng tư</h2>
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
        <h2><span className="icon-well"><AppIcon name="expense" size={18} /></span>Chi tiêu cá nhân</h2>
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
          onClick={onExpenses}
        >
          Mở chi tiêu cá nhân
        </button>
      </section>
      <div id="personal-received">
        <ReceivedShares />
      </div>
      </div>
      {profile.role === 'ADMIN' && <PinSettings admin />}
      {onLogout && (
        <section className="expense-card personal-account-actions">
          <h2><span className="icon-well"><AppIcon name="personal" size={18} /></span>Tài khoản</h2>
          <p>Khi dùng xong, bạn có thể đóng phiên trên thiết bị này.</p>
          <button type="button" onClick={onLogout} disabled={isLoggingOut}>
            {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất / Đổi thành viên'}
          </button>
        </section>
      )}
    </section>
  )
}

function roleLabel(role: FamilyProfile['role']) {
  return role === 'PARENT' ? 'Mẹ' : role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'
}
