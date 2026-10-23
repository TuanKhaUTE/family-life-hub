import { useEffect, useRef, useState } from 'react'
import type { FamilyProfile } from './auth-api'
import { ProfileAvatar } from './ProfileSelector'
import { AppIcon } from '../../ui/AppIcon'

const roleLabels: Record<FamilyProfile['role'], string> = {
  PARENT: 'Phụ huynh',
  MEMBER: 'Thành viên',
  ADMIN: 'Quản trị kỹ thuật',
}

export function AccountMenu({
  profile,
  isLoggingOut,
  onLogout,
  onOpenPersonal,
}: {
  profile: FamilyProfile
  isLoggingOut: boolean
  onLogout: () => void
  onOpenPersonal: () => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const sheet = sheetRef.current
    const trigger = triggerRef.current
    const first = sheet?.querySelector<HTMLElement>('button:not(:disabled)')
    first?.focus()

    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (
        target instanceof Node &&
        !sheet?.contains(target) &&
        !trigger?.contains(target)
      ) {
        close()
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !sheet) return
      const controls = Array.from(
        sheet.querySelectorAll<HTMLElement>('button:not(:disabled)'),
      )
      if (!controls.length) return
      const firstControl = controls[0]!
      const lastControl = controls[controls.length - 1]!
      if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault()
        lastControl.focus()
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault()
        firstControl.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="account-menu-wrap">
      <button
        ref={triggerRef}
        className="header-profile"
        type="button"
        aria-label={`Mở tài khoản của ${profile.displayName}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <ProfileAvatar profile={profile} />
      </button>
      {open && (
        <div
          ref={sheetRef}
          className="account-menu"
          role="dialog"
          aria-modal="false"
          aria-label="Tài khoản"
        >
          <div className="account-menu-profile">
            <ProfileAvatar profile={profile} />
            <div>
              <strong>{profile.displayName}</strong>
              <span>{roleLabels[profile.role]}</span>
            </div>
          </div>
          <button
            type="button"
            className="account-menu-action"
            onClick={() => {
              close()
              onOpenPersonal()
            }}
          >
            <AppIcon name="personal" size={19} />
            <span>Mở Cá nhân</span>
          </button>
          <button
            type="button"
            className="account-menu-action account-menu-action--logout"
            disabled={isLoggingOut}
            onClick={onLogout}
          >
            <AppIcon name="personal" size={19} />
            <span>{isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất / Đổi thành viên'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
