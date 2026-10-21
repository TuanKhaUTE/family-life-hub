import { AuthenticatedShell } from './AuthenticatedShell'
import { AuthStatusScreen } from './AuthStatusScreen'
import { PinLoginForm } from './PinLoginForm'
import { ProfileSelector } from './ProfileSelector'
import { useAuthFlow } from './use-auth-flow'

export function AuthFlow() {
  const {
    state,
    selectProfile,
    chooseAnotherProfile,
    submitPin,
    logOut,
    retry,
    refreshProfiles,
  } = useAuthFlow()

  switch (state.view) {
    case 'checking-session':
      return <AuthStatusScreen kind="loading" />
    case 'loading-profiles':
      return <AuthStatusScreen kind="loading" message="Gathering the family…" />
    case 'choosing-profile':
      return (
        <ProfileSelector
          profiles={state.profiles}
          onSelect={selectProfile}
          onRefresh={() => void refreshProfiles()}
        />
      )
    case 'entering-pin':
      return (
        <PinLoginForm
          profile={state.selectedProfile}
          error={state.error}
          isSubmitting={state.isSubmitting}
          onBack={chooseAnotherProfile}
          onSubmit={submitPin}
        />
      )
    case 'authenticated':
      return (
        <AuthenticatedShell
          profile={state.profile}
          isLoggingOut={state.isLoggingOut}
          error={state.error}
          onLogout={() => void logOut()}
        />
      )
    case 'unexpected-error':
      return <AuthStatusScreen kind="error" onRetry={retry} />
  }
}
