import { useCallback, useEffect, useRef, useState } from 'react'

import {
  AuthApiError,
  getCurrentProfile,
  getFamilyProfiles,
  loginWithPin,
  logout,
  type FamilyProfile,
} from './auth-api'

const INVALID_LOGIN_MESSAGE = 'Couldn’t verify that profile and PIN.'
const UNAVAILABLE_LOGIN_MESSAGE =
  'We couldn’t check that PIN right now. Please try again.'
const LOGOUT_ERROR_MESSAGE = 'We couldn’t confirm logout. Please try again.'

export type AuthFlowState =
  | { view: 'checking-session' }
  | { view: 'loading-profiles' }
  | { view: 'choosing-profile'; profiles: FamilyProfile[] }
  | {
      view: 'entering-pin'
      profiles: FamilyProfile[]
      selectedProfile: FamilyProfile
      isSubmitting: boolean
      error: string | null
    }
  | {
      view: 'authenticated'
      profile: FamilyProfile
      isLoggingOut: boolean
      error: string | null
    }
  | { view: 'unexpected-error'; retryOperation: 'session' | 'profiles' }

export function useAuthFlow() {
  const [state, setState] = useState<AuthFlowState>({
    view: 'checking-session',
  })
  const loginPending = useRef(false)
  const logoutPending = useRef(false)

  const loadProfiles = useCallback(async (): Promise<void> => {
    setState({ view: 'loading-profiles' })

    try {
      const profiles = await getFamilyProfiles()
      setState({ view: 'choosing-profile', profiles })
    } catch {
      setState({ view: 'unexpected-error', retryOperation: 'profiles' })
    }
  }, [])

  const checkSession = useCallback(async (): Promise<void> => {
    try {
      const profile = await getCurrentProfile()

      if (profile) {
        setState({
          view: 'authenticated',
          profile,
          isLoggingOut: false,
          error: null,
        })
        return
      }

      await loadProfiles()
    } catch {
      setState({ view: 'unexpected-error', retryOperation: 'session' })
    }
  }, [loadProfiles])

  const restoreSession = useCallback((): void => {
    setState({ view: 'checking-session' })
    void checkSession()
  }, [checkSession])

  useEffect(() => {
    let isCurrent = true

    void getCurrentProfile()
      .then((profile) => {
        if (!isCurrent) return

        if (profile) {
          setState({
            view: 'authenticated',
            profile,
            isLoggingOut: false,
            error: null,
          })
          return
        }

        setState({ view: 'loading-profiles' })
        return getFamilyProfiles()
          .then((profiles) => {
            if (isCurrent) {
              setState({ view: 'choosing-profile', profiles })
            }
          })
          .catch(() => {
            if (isCurrent) {
              setState({
                view: 'unexpected-error',
                retryOperation: 'profiles',
              })
            }
          })
      })
      .catch(() => {
        if (isCurrent) {
          setState({ view: 'unexpected-error', retryOperation: 'session' })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [])

  function selectProfile(profile: FamilyProfile): void {
    if (state.view !== 'choosing-profile') return

    setState({
      view: 'entering-pin',
      profiles: state.profiles,
      selectedProfile: profile,
      isSubmitting: false,
      error: null,
    })
  }

  function chooseAnotherProfile(): void {
    if (state.view !== 'entering-pin' || state.isSubmitting) return

    setState({ view: 'choosing-profile', profiles: state.profiles })
  }

  async function submitPin(pin: string): Promise<void> {
    if (state.view !== 'entering-pin' || loginPending.current) return

    const { profiles, selectedProfile } = state
    loginPending.current = true
    setState({ ...state, isSubmitting: true, error: null })

    try {
      const profile = await loginWithPin(selectedProfile.id, pin)
      setState({
        view: 'authenticated',
        profile,
        isLoggingOut: false,
        error: null,
      })
    } catch (error) {
      setState({
        view: 'entering-pin',
        profiles,
        selectedProfile,
        isSubmitting: false,
        error:
          error instanceof AuthApiError && error.status === 401
            ? INVALID_LOGIN_MESSAGE
            : UNAVAILABLE_LOGIN_MESSAGE,
      })
    } finally {
      loginPending.current = false
    }
  }

  async function logOut(): Promise<void> {
    if (state.view !== 'authenticated' || logoutPending.current) return

    const { profile } = state
    logoutPending.current = true
    setState({ ...state, isLoggingOut: true, error: null })

    try {
      await logout()
      await loadProfiles()
    } catch {
      setState({
        view: 'authenticated',
        profile,
        isLoggingOut: false,
        error: LOGOUT_ERROR_MESSAGE,
      })
    } finally {
      logoutPending.current = false
    }
  }

  function retry(): void {
    if (state.view !== 'unexpected-error') return

    if (state.retryOperation === 'session') {
      restoreSession()
    } else {
      void loadProfiles()
    }
  }

  return {
    state,
    selectProfile,
    chooseAnotherProfile,
    submitPin,
    logOut,
    retry,
    refreshProfiles: loadProfiles,
  }
}
