import { describe, expect, it } from 'vitest'

import {
  PromptCancelledError,
  runBootstrapFamilyMemberCommand,
  type BootstrapCommandService,
  type BootstrapPrompter,
} from '../src/cli/bootstrap-family-member.command.js'
import { FamilyMemberBootstrapDataError } from '../src/repositories/family-member-bootstrap.repository.js'
import {
  BootstrapValidationError,
  type BootstrapFamilyMemberInput,
  type FamilyMemberRole,
  type FamilyMemberSummary,
} from '../src/services/family-member-bootstrap.service.js'

const syntheticPin = '123456'
const syntheticHash = '$argon2id$synthetic-test-hash-value'

class ScriptedPrompter implements BootstrapPrompter {
  isInteractive = true
  textAnswers: string[] = []
  secretAnswers: string[] = []
  roleAnswers: FamilyMemberRole[] = []
  confirmAnswers: boolean[] = []
  textCalls = 0
  secretCalls = 0

  async text(): Promise<string> {
    this.textCalls += 1
    return nextAnswer(this.textAnswers)
  }

  async secret(): Promise<string> {
    this.secretCalls += 1
    return nextAnswer(this.secretAnswers)
  }

  async role(): Promise<FamilyMemberRole> {
    return nextAnswer(this.roleAnswers)
  }

  async confirm(): Promise<boolean> {
    return nextAnswer(this.confirmAnswers)
  }
}

class FakeService implements BootstrapCommandService {
  matches: FamilyMemberSummary[] = []
  findError?: Error
  createError?: Error
  findCalls: string[] = []
  createdInputs: BootstrapFamilyMemberInput[] = []

  async findDisplayNameMatches(
    displayName: string,
  ): Promise<FamilyMemberSummary[]> {
    this.findCalls.push(displayName)

    if (this.findError) {
      throw this.findError
    }

    return this.matches
  }

  async create(input: BootstrapFamilyMemberInput): Promise<string> {
    this.createdInputs.push(input)

    if (this.createError) {
      throw this.createError
    }

    return '11111111-1111-4111-8111-111111111111'
  }
}

function createHarness() {
  const prompter = new ScriptedPrompter()
  const service = new FakeService()
  const output: string[] = []
  const errors: string[] = []
  let serviceFactoryCalls = 0

  return {
    prompter,
    service,
    output,
    errors,
    get serviceFactoryCalls() {
      return serviceFactoryCalls
    },
    run: () =>
      runBootstrapFamilyMemberCommand({
        prompter,
        createService: () => {
          serviceFactoryCalls += 1
          return service
        },
        write: (message) => output.push(message),
        writeError: (message) => errors.push(message),
      }),
  }
}

function scriptSuccessfulAnswers(prompter: ScriptedPrompter): void {
  prompter.textAnswers = ['Synthetic Member']
  prompter.roleAnswers = ['MEMBER']
  prompter.confirmAnswers = [false, true]
  prompter.secretAnswers = [syntheticPin, syntheticPin]
}

describe('runBootstrapFamilyMemberCommand', () => {
  it('refuses non-interactive execution before creating the service', async () => {
    const harness = createHarness()
    harness.prompter.isInteractive = false

    await expect(harness.run()).resolves.toBe(1)
    expect(harness.serviceFactoryCalls).toBe(0)
    expect(harness.service.findCalls).toEqual([])
    expect(harness.service.createdInputs).toEqual([])
    expect(harness.errors.join('\n')).toContain('interactive terminal')
  })

  it('cancels safely without creating a member', async () => {
    const harness = createHarness()
    harness.prompter.text = async () => {
      throw new PromptCancelledError()
    }

    await expect(harness.run()).resolves.toBe(1)
    expect(harness.service.createdInputs).toEqual([])
    expect(harness.errors.join('\n')).toContain('cancelled')
  })

  it('does not create when final confirmation is refused', async () => {
    const harness = createHarness()
    scriptSuccessfulAnswers(harness.prompter)
    harness.prompter.confirmAnswers = [false, false]

    await expect(harness.run()).resolves.toBe(1)
    expect(harness.service.createdInputs).toEqual([])
    expect(harness.errors.join('\n')).toContain('cancelled')
  })

  it('creates one member from a confirmed interaction without exposing secrets', async () => {
    const harness = createHarness()
    scriptSuccessfulAnswers(harness.prompter)

    await expect(harness.run()).resolves.toBe(0)
    expect(harness.service.createdInputs).toEqual([
      {
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        avatarType: null,
        avatarValue: null,
        pin: syntheticPin,
        pinConfirmation: syntheticPin,
      },
    ])
    const visibleOutput = [...harness.output, ...harness.errors].join('\n')
    expect(visibleOutput).toContain('created successfully')
    expect(visibleOutput).not.toContain(syntheticPin)
    expect(visibleOutput).not.toContain(syntheticHash)
  })

  it('aborts a matching name before collecting a PIN by default', async () => {
    const harness = createHarness()
    harness.service.matches = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        isActive: true,
      },
    ]
    harness.prompter.textAnswers = ['Synthetic Member', 'cancel']

    await expect(harness.run()).resolves.toBe(1)
    expect(harness.prompter.secretCalls).toBe(0)
    expect(harness.service.createdInputs).toEqual([])
    expect(harness.errors.join('\n')).toContain('matching display name')
  })

  it('permits an intentional duplicate only with the exact confirmation phrase', async () => {
    const harness = createHarness()
    harness.service.matches = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        displayName: 'Synthetic Member',
        role: 'MEMBER',
        isActive: true,
      },
    ]
    scriptSuccessfulAnswers(harness.prompter)
    harness.prompter.textAnswers.push('CREATE DUPLICATE')

    await expect(harness.run()).resolves.toBe(0)
    expect(harness.prompter.secretCalls).toBe(2)
    expect(harness.service.createdInputs).toHaveLength(1)
  })

  it('reports invalid input without printing the rejected values', async () => {
    const harness = createHarness()
    scriptSuccessfulAnswers(harness.prompter)
    harness.service.createError = new BootstrapValidationError(
      'Avatar details are invalid',
    )

    await expect(harness.run()).resolves.toBe(1)
    const visibleOutput = [...harness.output, ...harness.errors].join('\n')
    expect(visibleOutput).toContain('Avatar details are invalid')
    expect(visibleOutput).not.toContain(syntheticPin)
    expect(visibleOutput).not.toContain(syntheticHash)
  })

  it('describes an RPC failure as uncertain without claiming account absence', async () => {
    const harness = createHarness()
    scriptSuccessfulAnswers(harness.prompter)
    harness.service.createError = new FamilyMemberBootstrapDataError(
      `upstream failure ${syntheticPin} ${syntheticHash}`,
    )

    await expect(harness.run()).resolves.toBe(1)
    const visibleOutput = [...harness.output, ...harness.errors].join('\n')
    expect(visibleOutput).toContain('could not be confirmed')
    expect(visibleOutput).not.toContain('no account')
    expect(visibleOutput).not.toContain(syntheticPin)
    expect(visibleOutput).not.toContain(syntheticHash)
  })
})

function nextAnswer<T>(answers: T[]): T {
  const answer = answers.shift()

  if (answer === undefined) {
    throw new Error('Missing scripted prompt answer')
  }

  return answer
}
