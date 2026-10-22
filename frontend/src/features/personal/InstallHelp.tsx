import { useEffect, useState } from 'react'
import { isIosDevice, isStandalone } from './install-utils'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallHelp() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(isStandalone)
  const ios = isIosDevice()

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const installed = () => {
      setPromptEvent(null)
      setStandalone(true)
    }
    window.addEventListener('beforeinstallprompt', capturePrompt)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  if (standalone) return null
  if (!ios && !promptEvent) return null

  return (
    <section className="expense-card install-help" aria-labelledby="install-help-title">
      <h2 id="install-help-title">Cài Family Life Hub</h2>
      {ios ? (
        <p>
          Trên iPhone Safari, chọn <strong>Chia sẻ → Thêm vào Màn hình chính</strong>.
        </p>
      ) : (
        <>
          <p>Đưa Family Life Hub lên màn hình chính để mở nhanh hơn.</p>
          <button
            type="button"
            className="expense-primary"
            onClick={() => {
              if (!promptEvent) return
              void promptEvent.prompt().finally(() => setPromptEvent(null))
            }}
          >
            Cài ứng dụng
          </button>
        </>
      )}
    </section>
  )
}

