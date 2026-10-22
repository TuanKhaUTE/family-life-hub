import { useState } from 'react'

import type { FamilyProfile } from './auth-api'

interface ProfileSelectorProps {
  notice?: string
  profiles: FamilyProfile[]
  onSelect: (profile: FamilyProfile) => void
  onRefresh: () => void
}

export function ProfileSelector({
  profiles,
  onSelect,
  onRefresh,
  notice,
}: ProfileSelectorProps) {
  return (
    <section
      className="auth-card profile-selector"
      aria-labelledby="profile-title"
    >
      <header className="auth-heading">
        <p className="eyebrow">Family Life Hub</p>
        <h1 id="profile-title">Hôm nay ai đang dùng?</h1>
        <p className="auth-copy">Chọn hồ sơ của bạn để vào nhà nhé.</p>
      </header>
      {notice && <p role="status">{notice}</p>}

      {profiles.length > 0 ? (
        <ul className="profile-grid" aria-label="Hồ sơ gia đình">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <button
                className="profile-card"
                type="button"
                aria-label={`Tiếp tục với ${profile.displayName}`}
                onClick={() => onSelect(profile)}
              >
                <ProfileAvatar profile={profile} />
                <span className="profile-name">{profile.displayName}</span>
                <span className="profile-action" aria-hidden="true">
                  Vào nhà <span>→</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-profiles">
          <p>Hiện chưa có hồ sơ gia đình nào.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={onRefresh}
          >
            Kiểm tra lại
          </button>
        </div>
      )}
    </section>
  )
}

interface AvatarProfile {
  displayName: string
  avatarType: string | null
  avatarValue: string | null
}

export function ProfileAvatar({ profile }: { profile: AvatarProfile }) {
  const [imageFailed, setImageFailed] = useState(false)
  const avatarValue = profile.avatarValue?.trim() ?? ''
  const avatarType = profile.avatarType?.toUpperCase() ?? ''
  const isEmoji = avatarType === 'EMOJI' && avatarValue.length > 0
  const isImage =
    !imageFailed &&
    avatarValue.length > 0 &&
    (avatarValue.startsWith('/') || /^https?:\/\//i.test(avatarValue))

  if (isImage) {
    return (
      <span className="profile-avatar" aria-hidden="true">
        <img
          src={avatarValue}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      </span>
    )
  }

  return (
    <span className="profile-avatar" aria-hidden="true">
      {isEmoji ? avatarValue : getInitial(profile.displayName)}
    </span>
  )
}

function getInitial(displayName: string): string {
  return displayName.trim().charAt(0).toLocaleUpperCase() || '♥'
}
