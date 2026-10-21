import { useState } from 'react'

import type { FamilyProfile } from './auth-api'

interface ProfileSelectorProps {
  profiles: FamilyProfile[]
  onSelect: (profile: FamilyProfile) => void
  onRefresh: () => void
}

export function ProfileSelector({
  profiles,
  onSelect,
  onRefresh,
}: ProfileSelectorProps) {
  return (
    <section className="auth-card profile-selector" aria-labelledby="profile-title">
      <header className="auth-heading">
        <p className="eyebrow">Family Life Hub</p>
        <h1 id="profile-title">Who’s home today?</h1>
        <p className="auth-copy">Choose your profile to step inside.</p>
      </header>

      {profiles.length > 0 ? (
        <ul className="profile-grid" aria-label="Family profiles">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <button
                className="profile-card"
                type="button"
                aria-label={`Continue as ${profile.displayName}`}
                onClick={() => onSelect(profile)}
              >
                <ProfileAvatar profile={profile} />
                <span className="profile-name">{profile.displayName}</span>
                <span className="profile-action" aria-hidden="true">
                  Come in <span>→</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-profiles">
          <p>No family profiles are available right now.</p>
          <button className="secondary-button" type="button" onClick={onRefresh}>
            Check again
          </button>
        </div>
      )}
    </section>
  )
}

export function ProfileAvatar({ profile }: { profile: FamilyProfile }) {
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
