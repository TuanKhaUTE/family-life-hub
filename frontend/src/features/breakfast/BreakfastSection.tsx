import { useEffect, useRef, useState, type FormEvent } from 'react'

import type { FamilyProfile } from '../auth/auth-api'
import { ProfileAvatar } from '../auth/ProfileSelector'
import {
  BreakfastClosedApiError,
  fetchBreakfastCatalog,
  fetchBreakfastDay,
  saveBreakfastResponse,
  type BreakfastCatalogItem,
  type BreakfastDay,
  type BreakfastDayResponse,
  type BreakfastSubmission,
} from './breakfast-api'
import './breakfast.css'

interface BreakfastSectionProps {
  profile: FamilyProfile
}

type Draft =
  | { state: 'SELECTED'; catalogItemId: string }
  | { state: 'CUSTOM'; customText: string }
  | { state: 'NOT_EATING' }
  | { state: 'NO_RESPONSE' }

export function BreakfastSection({ profile }: BreakfastSectionProps) {
  const [day, setDay] = useState<BreakfastDay | null>(null)
  const [catalog, setCatalog] = useState<BreakfastCatalogItem[]>([])
  const [draft, setDraft] = useState<Draft>({ state: 'NO_RESPONSE' })
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const submittingRef = useRef(false)
  const isParent = profile.role === 'PARENT'

  useEffect(() => {
    let active = true

    void Promise.all([
      fetchBreakfastDay(),
      isParent ? Promise.resolve([]) : fetchBreakfastCatalog(),
    ])
      .then(([loadedDay, loadedCatalog]) => {
        if (!active) return
        setDay(loadedDay)
        setCatalog(loadedCatalog)
        const ownResponse = loadedDay.responses.find(
          (item) => item.member.id === profile.id,
        )
        setDraft(toDraft(ownResponse))
        setLoadState('ready')
      })
      .catch(() => {
        if (active) setLoadState('error')
      })

    return () => {
      active = false
    }
  }, [isParent, profile.id, reloadKey])

  if (loadState === 'loading') {
    return (
      <section className="breakfast-card" aria-labelledby="breakfast-title">
        <BreakfastHeader />
        <p className="breakfast-message" role="status">
          Setting the breakfast table…
        </p>
      </section>
    )
  }

  if (loadState === 'error' || day === null) {
    return (
      <section className="breakfast-card" aria-labelledby="breakfast-title">
        <BreakfastHeader />
        <div className="breakfast-message breakfast-message--error">
          <p>We couldn’t load breakfast right now.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setLoadState('loading')
              setSaveError(null)
              setReloadKey((value) => value + 1)
            }}
          >
            Try breakfast again
          </button>
        </div>
      </section>
    )
  }

  if (isParent) {
    return <ParentBreakfastView day={day} />
  }

  const ownResponse =
    day.responses.find((item) => item.member.id === profile.id) ?? null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current || day === null) return
    const submission = toSubmission(draft)
    if (submission === null) return

    submittingRef.current = true
    setIsSaving(true)
    setSaveError(null)
    try {
      const saved = await saveBreakfastResponse(day.date, submission)
      setDay((current) =>
        current === null
          ? current
          : {
              ...current,
              responses: current.responses.map((item) =>
                item.member.id === saved.member.id ? saved : item,
              ),
            },
      )
      setDraft(toDraft(saved))
    } catch (error) {
      if (error instanceof BreakfastClosedApiError) {
        setDay((current) =>
          current === null ? current : { ...current, isOpen: false },
        )
      } else {
        setSaveError('We couldn’t save your breakfast choice. Please try again.')
      }
    } finally {
      submittingRef.current = false
      setIsSaving(false)
    }
  }

  return (
    <section className="breakfast-card" aria-labelledby="breakfast-title">
      <BreakfastHeader day={day} />
      <SavedChoice response={ownResponse} />

      {!day.isOpen ? (
        <div className="breakfast-closed" role="status">
          <strong>Breakfast choices are closed</strong>
          <span>The midnight deadline has passed for this morning.</span>
        </div>
      ) : (
        <form className="breakfast-form" onSubmit={handleSubmit}>
          <fieldset>
            <legend>What would you like?</legend>
            <div className="breakfast-options">
              {catalog.map((item) => (
                <ChoiceCard
                  key={item.id}
                  label={item.name}
                  checked={
                    draft.state === 'SELECTED' &&
                    draft.catalogItemId === item.id
                  }
                  onSelect={() =>
                    setDraft({ state: 'SELECTED', catalogItemId: item.id })
                  }
                />
              ))}
              <ChoiceCard
                label="Other / custom"
                checked={draft.state === 'CUSTOM'}
                tone="peach"
                onSelect={() =>
                  setDraft({
                    state: 'CUSTOM',
                    customText:
                      draft.state === 'CUSTOM' ? draft.customText : '',
                  })
                }
              />
              <ChoiceCard
                label="Not eating"
                checked={draft.state === 'NOT_EATING'}
                tone="quiet"
                onSelect={() => setDraft({ state: 'NOT_EATING' })}
              />
            </div>
          </fieldset>

          {draft.state === 'CUSTOM' && (
            <label className="custom-choice">
              <span>Your breakfast</span>
              <input
                value={draft.customText}
                maxLength={120}
                autoComplete="off"
                placeholder="e.g. Cháo gà"
                onChange={(event) =>
                  setDraft({ state: 'CUSTOM', customText: event.target.value })
                }
              />
            </label>
          )}

          {saveError && (
            <p className="breakfast-save-error" role="alert">
              {saveError}
            </p>
          )}

          <button
            className="primary-button breakfast-save"
            type="submit"
            disabled={!canSubmit(draft) || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save breakfast choice'}
          </button>
        </form>
      )}
    </section>
  )
}

function BreakfastHeader({ day }: { day?: BreakfastDay }) {
  return (
    <header className="breakfast-heading">
      <div>
        <p className="eyebrow">Next breakfast</p>
        <h2 id="breakfast-title">Breakfast</h2>
      </div>
      <span className="breakfast-date">
        {day ? formatFamilyDate(day.date, day.timeZone) : 'Next family day'}
      </span>
    </header>
  )
}

function ChoiceCard({
  label,
  checked,
  onSelect,
  tone = 'sage',
}: {
  label: string
  checked: boolean
  onSelect: () => void
  tone?: 'sage' | 'peach' | 'quiet'
}) {
  return (
    <label
      className={`breakfast-option breakfast-option--${tone}${checked ? ' is-selected' : ''}`}
    >
      <input
        type="radio"
        name="breakfast-choice"
        checked={checked}
        onChange={onSelect}
      />
      <span>{label}</span>
      <i aria-hidden="true">{checked ? '✓' : ''}</i>
    </label>
  )
}

function SavedChoice({ response }: { response: BreakfastDayResponse | null }) {
  return (
    <p className="saved-choice" aria-live="polite">
      {response === null || response.state === 'NO_RESPONSE'
        ? 'No response saved yet'
        : `Saved: ${describeResponse(response)}`}
    </p>
  )
}

function ParentBreakfastView({ day }: { day: BreakfastDay }) {
  return (
    <section className="breakfast-card" aria-labelledby="breakfast-title">
      <BreakfastHeader day={day} />
      <p className="breakfast-parent-copy">
        Here’s what the family has chosen for breakfast.
      </p>
      <ul className="breakfast-status-list" aria-label="Family breakfast responses">
        {day.responses.map((response) => (
          <li key={response.member.id}>
            <ProfileAvatar profile={response.member} />
            <div>
              <strong>{response.member.displayName}</strong>
              <span className={`status-${response.state.toLowerCase()}`}>
                {describeParentResponse(response)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function toDraft(response?: BreakfastDayResponse): Draft {
  if (response?.state === 'SELECTED' && response.catalogItem) {
    return { state: 'SELECTED', catalogItemId: response.catalogItem.id }
  }
  if (response?.state === 'CUSTOM') {
    return { state: 'CUSTOM', customText: response.customText ?? '' }
  }
  if (response?.state === 'NOT_EATING') return { state: 'NOT_EATING' }
  return { state: 'NO_RESPONSE' }
}

function toSubmission(draft: Draft): BreakfastSubmission | null {
  if (draft.state === 'SELECTED') return draft
  if (draft.state === 'NOT_EATING') return draft
  if (draft.state === 'CUSTOM') {
    const customText = draft.customText.trim()
    return customText ? { state: 'CUSTOM', customText } : null
  }
  return null
}

function canSubmit(draft: Draft): boolean {
  return (
    draft.state === 'SELECTED' ||
    draft.state === 'NOT_EATING' ||
    (draft.state === 'CUSTOM' && draft.customText.trim().length > 0)
  )
}

function describeResponse(response: BreakfastDayResponse): string {
  if (response.state === 'SELECTED') return response.catalogItem?.name ?? 'Selected dish'
  if (response.state === 'CUSTOM') return response.customText ?? 'Custom dish'
  if (response.state === 'NOT_EATING') return 'Not eating'
  return 'No response yet'
}

function describeParentResponse(response: BreakfastDayResponse): string {
  if (response.state === 'SELECTED') return `Selected · ${describeResponse(response)}`
  if (response.state === 'CUSTOM') return `Custom · ${describeResponse(response)}`
  if (response.state === 'NOT_EATING') return 'Not eating'
  return 'No response yet'
}

function formatFamilyDate(date: string, timeZone: string): string {
  const instant = new Date(`${date}T12:00:00Z`)
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(instant)
}
