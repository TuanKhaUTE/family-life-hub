import { useRef, useState, type FormEvent } from 'react'

import type { FamilyProfile } from './auth-api'
import { ProfileAvatar } from './ProfileSelector'

interface PinLoginFormProps {
  profile: FamilyProfile
  error: string | null
  isSubmitting: boolean
  onBack: () => void
  onSubmit: (pin: string) => Promise<void>
}

export function PinLoginForm({
  profile,
  error,
  isSubmitting,
  onBack,
  onSubmit,
}: PinLoginFormProps) {
  const [pin, setPin] = useState('')
  const submitGuard = useRef(false)
  const isComplete = /^\d{6}$/.test(pin)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    if (!isComplete || isSubmitting || submitGuard.current) return

    submitGuard.current = true
    const submittedPin = pin
    setPin('')

    try {
      await onSubmit(submittedPin)
    } finally {
      submitGuard.current = false
    }
  }

  return (
    <section className="auth-card pin-panel" aria-labelledby="pin-title">
      <button
        className="back-button"
        type="button"
        disabled={isSubmitting}
        onClick={onBack}
        aria-label="Chọn hồ sơ khác"
      >
        <span aria-hidden="true">←</span> Quay lại
      </button>

      <div className="selected-profile">
        <ProfileAvatar profile={profile} />
        <p className="eyebrow">Chào mừng trở lại</p>
        <h1 id="pin-title">Chào {profile.displayName}</h1>
        <p className="auth-copy">Nhập mã PIN 6 số để tiếp tục.</p>
      </div>

      <form className="pin-form" onSubmit={handleSubmit}>
        <label htmlFor="family-pin">Mã PIN 6 số</label>
        <input
          id="family-pin"
          name="family-pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="off"
          autoFocus
          disabled={isSubmitting}
          value={pin}
          onChange={(event) =>
            setPin(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))
          }
          aria-describedby={error ? 'pin-error pin-help' : 'pin-help'}
          aria-invalid={error ? true : undefined}
        />
        <p id="pin-help" className="field-help">
          6 chữ số quen thuộc của bạn.
        </p>
        {error && (
          <p id="pin-error" className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          type="submit"
          disabled={!isComplete || isSubmitting}
        >
          {isSubmitting ? 'Đang kiểm tra…' : 'Vào Family Life Hub'}
        </button>
      </form>
    </section>
  )
}
