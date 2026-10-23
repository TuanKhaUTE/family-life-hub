import { useEffect, useRef, useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import { AppIcon } from '../../ui/AppIcon'
import {
  fetchSettings,
  saveProfile,
  profileError,
  type ProfileSettings as Settings,
} from './profile-api'
export function ProfileSettings({
  profile,
  onUpdated,
}: {
  profile: FamilyProfile
  onUpdated?: (p: FamilyProfile) => void
}) {
  const [data, setData] = useState<Settings | null>(null),
    [failed, setFailed] = useState(false),
    [version, setVersion] = useState(0),
    [editing, setEditing] = useState(false),
    [name, setName] = useState(profile.displayName),
    [avatar, setAvatar] = useState({
      avatarType: profile.avatarType,
      avatarValue: profile.avatarValue,
    }),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const c = new AbortController()
    void fetchSettings(c.signal)
      .then((d) => {
        if (!c.signal.aborted) {
          setData(d)
          setFailed(false)
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setFailed(true)
      })
    return () => c.abort()
  }, [version])
  function close() {
    setEditing(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  async function submit(e: React.SubmitEvent) {
    e.preventDefault()
    if (pending) return
    setError(null)
    if (
      !name.trim() ||
      Array.from(name.trim()).length > 100 ||
      /\p{Cc}/u.test(name)
    ) {
      setError(
        'Tên hiển thị cần có từ 1 đến 100 ký tự, không chứa ký tự điều khiển.',
      )
      return
    }
    setPending(true)
    try {
      const p = await saveProfile({ displayName: name.trim(), ...avatar })
      setData((d) => (d ? { ...d, profile: p } : d))
      onUpdated?.(p)
      setNotice('Đã cập nhật hồ sơ của bạn.')
      close()
    } catch (e) {
      setError(profileError(e))
    } finally {
      setPending(false)
    }
  }
  return (
    <section className="expense-card profile-settings">
      <h2><span className="icon-well"><AppIcon name="personal" size={18} /></span>Hồ sơ của bạn</h2>
      <div className="personal-identity">
        <ProfileAvatar
          key={profile.avatarValue}
          profile={data?.profile ?? profile}
        />
        <div>
          <strong>{data?.profile.displayName ?? profile.displayName}</strong>
          <p>
            {
              {
                ADMIN: 'Quản trị kỹ thuật',
                PARENT: 'Phụ huynh',
                MEMBER: 'Thành viên',
              }[profile.role]
            }
          </p>
        </div>
      </div>
      {!data && !failed && <p role="status">Đang mở hồ sơ…</p>}
      {failed && (
        <>
          <p>Chưa tải được hồ sơ. Bạn thử lại nhé.</p>
          <button
            onClick={() => {
              setFailed(false)
              setVersion((v) => v + 1)
            }}
          >
            Thử tải lại hồ sơ
          </button>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {data && (
        <button
          ref={trigger}
          hidden={editing}
          onClick={() => {
            setName(data.profile.displayName)
            setAvatar({
              avatarType: data.profile.avatarType,
              avatarValue: data.profile.avatarValue,
            })
            setError(null)
            setNotice(null)
            setEditing(true)
          }}
        >
          Chỉnh sửa hồ sơ
        </button>
      )}
      {editing && data && (
        <form onSubmit={submit}>
          <label>
            Tên hiển thị
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
              required
            />
          </label>
          <fieldset disabled={pending}>
            <legend>Chọn ảnh đại diện</legend>
            <div className="avatar-choices">
              <label>
                <input
                  type="radio"
                  name="avatar"
                  checked={avatar.avatarType === null}
                  onChange={() =>
                    setAvatar({ avatarType: null, avatarValue: null })
                  }
                />
                Chữ cái đầu
              </label>
              {data.avatarChoices.map((a) => (
                <label key={a.avatarValue}>
                  <input
                    type="radio"
                    name="avatar"
                    checked={
                      avatar.avatarType === a.avatarType &&
                      avatar.avatarValue === a.avatarValue
                    }
                    onChange={() =>
                      setAvatar({
                        avatarType: a.avatarType,
                        avatarValue: a.avatarValue,
                      })
                    }
                  />
                  <span aria-hidden="true">{a.avatarValue}</span>
                  {a.label}
                </label>
              ))}
              {data.profile.avatarType !== null &&
                !data.avatarChoices.some(
                  (a) =>
                    a.avatarType === data.profile.avatarType &&
                    a.avatarValue === data.profile.avatarValue,
                ) && (
                  <label>
                    <input
                      type="radio"
                      name="avatar"
                      checked={
                        avatar.avatarType === data.profile.avatarType &&
                        avatar.avatarValue === data.profile.avatarValue
                      }
                      onChange={() =>
                        setAvatar({
                          avatarType: data.profile.avatarType,
                          avatarValue: data.profile.avatarValue,
                        })
                      }
                    />
                    Giữ ảnh hiện tại
                  </label>
                )}
            </div>
          </fieldset>
          {error && <p role="alert">{error}</p>}
          <div className="personal-actions">
            <button disabled={pending} type="submit">
              {pending ? 'Đang lưu…' : 'Lưu hồ sơ'}
            </button>
            <button type="button" disabled={pending} onClick={close}>
              Hủy
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
