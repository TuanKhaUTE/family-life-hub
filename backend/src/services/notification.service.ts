export interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  relatedResourceType: string | null
  relatedResourceId: string | null
  relatedDate: string | null
  readAt: string | null
  createdAt: string
}

export interface NotificationRepository {
  listForRecipient(recipientMemberId: string): Promise<AppNotification[]>
  markRead(
    id: string,
    recipientMemberId: string,
    readAt: Date,
  ): Promise<AppNotification | null>
}

type Clock = () => Date
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class NotificationValidationError extends Error {
  constructor() {
    super('Invalid notification request')
    this.name = 'NotificationValidationError'
  }
}

export class NotificationNotFoundError extends Error {
  constructor() {
    super('Notification was not found')
    this.name = 'NotificationNotFoundError'
  }
}

export class NotificationUnavailableError extends Error {
  constructor() {
    super('Notifications are temporarily unavailable')
    this.name = 'NotificationUnavailableError'
  }
}

export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async list(recipientMemberId: string): Promise<AppNotification[]> {
    try {
      return await this.repository.listForRecipient(recipientMemberId)
    } catch {
      throw new NotificationUnavailableError()
    }
  }

  async markRead(
    recipientMemberId: string,
    notificationId: unknown,
  ): Promise<AppNotification> {
    if (typeof notificationId !== 'string' || !UUID_PATTERN.test(notificationId)) {
      throw new NotificationValidationError()
    }

    let notification: AppNotification | null
    try {
      notification = await this.repository.markRead(
        notificationId,
        recipientMemberId,
        this.clock(),
      )
    } catch {
      throw new NotificationUnavailableError()
    }

    if (notification === null) throw new NotificationNotFoundError()
    return notification
  }
}
