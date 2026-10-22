import type { ActivityView } from './activity-api'
export function emptyActivityView(): ActivityView {
  const period = { minutes: 0, sessions: 0, previousMinutes: 0, previousSessions: 0, differenceMinutes: 0, differenceSessions: 0, percentage: null }
  return { plans: [], progress: { today: { minutes: 0, sessions: 0 }, week: { ...period }, month: { ...period }, consistency: { planned: 0, completed: 0, streak: 0 } } }
}
