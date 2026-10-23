import { useEffect, useRef, useState } from 'react'
import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import { AppIcon } from '../../ui/AppIcon'
import {
  avatarError,
  fetchSettings,
  saveProfile,
  profileError,
  uploadAvatar,
  type ProfileSettings as Settings,
} from './profile-api'
import { AvatarInputError, normalizeAvatarImage } from './avatar-image'
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
    [avatarFile, setAvatarFile] = useState<Blob | null>(null),
    [avatarPreview, setAvatarPreview] = useState<string | null>(null),
    [processingFile, setProcessingFile] = useState(false),
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
  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    },
    [avatarPreview],
  )
  const currentProfile = data?.profile ?? profile
  function clearPreview() {
    setAvatarFile(null)
    setAvatarPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
  }
  function choosePreset(avatarType: string | null, avatarValue: string | null) {
    clearPreview()
    setAvatar({ avatarType, avatarValue })
  }
  async function chooseFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setProcessingFile(true)
    try {
      const normalized = await normalizeAvatarImage(file)
      setAvatarFile(normalized)
      setAvatarPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(normalized)
      })
      setAvatar({ avatarType: 'IMAGE', avatarValue: currentProfile.avatarValue })
    } catch (error) {
      setError(
        error instanceof AvatarInputError
          ? error.message
          : 'Chưa thể đọc ảnh đại diện. Vui lòng thử lại.',
      )
    } finally {
      setProcessingFile(false)
    }
  }
  function close() {
    clearPreview()
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
      let p = avatarFile
        ? await uploadAvatar(avatarFile)
        : await saveProfile({ displayName: name.trim(), ...avatar })
      if (avatarFile && p.displayName !== name.trim()) {
        p = await saveProfile({
          displayName: name.trim(),
          avatarType: 'IMAGE',
          avatarValue: p.avatarValue,
        })
      }
      setData((d) => (d ? { ...d, profile: p } : d))
      onUpdated?.(p)
      setNotice('Đã cập nhật hồ sơ của bạn.')
      close()
    } catch (e) {
      setError(avatarFile ? avatarError(e) : profileError(e))
    } finally {
      setPending(false)
    }
  }
  return (
    <section className="expense-card profile-settings">
      <h2><span className="icon-well"><AppIcon name="personal" size={18} /></span>Hồ sơ của bạn</h2>
      <div className="personal-identity">
        <ProfileAvatar
          key={currentProfile.avatarValue}
          profile={currentProfile}
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
          <fieldset disabled={pending || processingFile}>
            <legend>Chọn ảnh đại diện</legend>
            <div className="avatar-choices">
              <label>
                <input
                  type="radio"
                  name="avatar"
                  checked={avatar.avatarType === null}
                  onChange={() => choosePreset(null, null)}
                />
                Chữ cái đầu
              </label>
              {currentProfile.avatarType === 'IMAGE' && (
                <label>
                  <input
                    type="radio"
                    name="avatar"
                    checked={avatar.avatarType === 'IMAGE'}
                    onChange={() =>
                      choosePreset('IMAGE', currentProfile.avatarValue)
                    }
                  />
                  Ảnh của tôi
                </label>
              )}
              {data.avatarChoices.map((a) => (
                <label key={a.avatarValue}>
                  <input
                    type="radio"
                    name="avatar"
                    checked={
                      avatar.avatarType === a.avatarType &&
                      avatar.avatarValue === a.avatarValue
                    }
                    onChange={() => choosePreset(a.avatarType, a.avatarValue)}
                  />
                  <span aria-hidden="true">{a.avatarValue}</span>
                  {a.label}
                </label>
              ))}
              {data.profile.avatarType !== null &&
                currentProfile.avatarType !== 'IMAGE' &&
                !data.avatarChoices.some(
                  (a) =>
                    a.avatarType === currentProfile.avatarType &&
                    a.avatarValue === currentProfile.avatarValue,
                ) && (
                  <label>
                    <input
                      type="radio"
                      name="avatar"
                      checked={
                        avatar.avatarType === currentProfile.avatarType &&
                        avatar.avatarValue === currentProfile.avatarValue
                      }
                      onChange={() =>
                        choosePreset(
                          currentProfile.avatarType,
                          currentProfile.avatarValue,
                        )
                      }
                    />
                    Giữ ảnh hiện tại
                  </label>
                )}
              <label className="avatar-upload-option" htmlFor="avatar-file">
                <span>Chọn ảnh từ thiết bị</span>
                <input
                  id="avatar-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    void chooseFile(event.currentTarget.files?.[0])
                    event.currentTarget.value = ''
                  }}
                />
              </label>
            </div>
            {processingFile && <p role="status">Đang chuẩn hóa ảnh…</p>}
            {avatarPreview && (
              <img
                className="profile-avatar-preview"
                src={avatarPreview}
                alt="Xem trước ảnh đại diện"
              />
            )}
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
