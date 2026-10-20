import { PinValidationError } from '../security/pin.js'
import {
  BootstrapValidationError,
  type BootstrapFamilyMemberInput,
  type FamilyMemberRole,
  type FamilyMemberSummary,
} from '../services/family-member-bootstrap.service.js'

export interface BootstrapPrompter {
  readonly isInteractive: boolean
  text(message: string): Promise<string>
  secret(message: string): Promise<string>
  role(message: string): Promise<FamilyMemberRole>
  confirm(message: string): Promise<boolean>
}

export interface BootstrapCommandService {
  findDisplayNameMatches(displayName: string): Promise<FamilyMemberSummary[]>
  create(input: BootstrapFamilyMemberInput): Promise<string>
}

interface BootstrapCommandDependencies {
  prompter: BootstrapPrompter
  createService: () => BootstrapCommandService
  write: (message: string) => void
  writeError: (message: string) => void
}

export class PromptCancelledError extends Error {
  constructor() {
    super('Interactive prompt was cancelled')
    this.name = 'PromptCancelledError'
  }
}

export async function runBootstrapFamilyMemberCommand({
  prompter,
  createService,
  write,
  writeError,
}: BootstrapCommandDependencies): Promise<number> {
  if (!prompter.isInteractive) {
    writeError('This command requires an interactive terminal.')
    return 1
  }

  let creationAttempted = false

  try {
    const service = createService()
    const displayName = await prompter.text('Display name: ')
    const matches = await service.findDisplayNameMatches(displayName)

    if (matches.length > 0) {
      writeError(
        `Warning: found ${matches.length} existing member(s) with a matching display name.`,
      )
      const acknowledgement = await prompter.text(
        'Type CREATE DUPLICATE to continue, or press Enter to cancel: ',
      )

      if (acknowledgement !== 'CREATE DUPLICATE') {
        writeError('Bootstrap cancelled because the display name already exists.')
        return 1
      }
    }

    const role = await prompter.role('Role')
    const configureAvatar = await prompter.confirm(
      'Configure an avatar now? (y/N): ',
    )
    const avatarType = configureAvatar
      ? await prompter.text('Avatar type: ')
      : null
    const avatarValue = configureAvatar
      ? await prompter.text('Avatar value: ')
      : null
    const pin = await prompter.secret('Six-digit PIN: ')
    const pinConfirmation = await prompter.secret('Confirm PIN: ')

    write('Review the new family member:')
    write(`Display name: ${displayName.trim()}`)
    write(`Role: ${role}`)
    write(`Avatar configured: ${configureAvatar ? 'yes' : 'no'}`)

    const confirmed = await prompter.confirm('Create this member? (y/N): ')

    if (!confirmed) {
      writeError('Bootstrap cancelled. No creation was attempted.')
      return 1
    }

    creationAttempted = true
    await service.create({
      displayName,
      role,
      avatarType,
      avatarValue,
      pin,
      pinConfirmation,
    })
    write('Family member created successfully.')
    return 0
  } catch (error) {
    if (error instanceof PromptCancelledError) {
      writeError('Bootstrap cancelled. No creation was attempted.')
      return 1
    }

    if (
      error instanceof BootstrapValidationError ||
      error instanceof PinValidationError
    ) {
      writeError(`Input rejected: ${error.message}`)
      return 1
    }

    if (creationAttempted) {
      writeError(
        'Creation outcome could not be confirmed. Run the command again and use the duplicate-name preflight to inspect the result.',
      )
      return 1
    }

    writeError('Bootstrap stopped before creation could be attempted.')
    return 1
  }
}
