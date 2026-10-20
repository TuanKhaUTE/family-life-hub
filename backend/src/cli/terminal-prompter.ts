import { createInterface, type Interface } from 'node:readline/promises'
import { Writable } from 'node:stream'

import {
  PromptCancelledError,
  type BootstrapPrompter,
} from './bootstrap-family-member.command.js'
import type { FamilyMemberRole } from '../services/family-member-bootstrap.service.js'

type TerminalInput = NodeJS.ReadableStream & { isTTY?: boolean }
type TerminalOutput = NodeJS.WritableStream & { isTTY?: boolean }

export class PromptInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PromptInputError'
  }
}

export class TerminalBootstrapPrompter implements BootstrapPrompter {
  readonly isInteractive: boolean

  private readonly mutedOutput: MutedOutput
  private readonly readline: Interface
  private activeQuestion?: AbortController

  constructor(
    input: TerminalInput,
    private readonly output: TerminalOutput,
  ) {
    this.isInteractive = Boolean(input.isTTY && output.isTTY)
    this.mutedOutput = new MutedOutput(output)
    this.readline = createInterface({
      input,
      output: this.mutedOutput,
      terminal: this.isInteractive,
    })
    this.readline.on('SIGINT', () => {
      this.activeQuestion?.abort()
    })
  }

  async text(message: string): Promise<string> {
    return this.ask(message, false)
  }

  async secret(message: string): Promise<string> {
    return this.ask(message, true)
  }

  async role(message: string): Promise<FamilyMemberRole> {
    this.output.write(`${message}:\n1. ADMIN\n2. PARENT\n3. MEMBER\n`)
    const answer = (await this.text('Select role [1-3]: ')).trim()

    switch (answer) {
      case '1':
        return 'ADMIN'
      case '2':
        return 'PARENT'
      case '3':
        return 'MEMBER'
      default:
        throw new PromptInputError('Role selection must be 1, 2, or 3')
    }
  }

  async confirm(message: string): Promise<boolean> {
    const answer = (await this.text(message)).trim().toLowerCase()

    if (answer === 'y' || answer === 'yes') {
      return true
    }

    if (answer === '' || answer === 'n' || answer === 'no') {
      return false
    }

    throw new PromptInputError('Confirmation must be yes or no')
  }

  close(): void {
    this.readline.close()
  }

  private async ask(message: string, secret: boolean): Promise<string> {
    const controller = new AbortController()
    this.activeQuestion = controller

    if (secret) {
      this.output.write(message)
      this.mutedOutput.muted = true
    }

    try {
      return await this.readline.question(secret ? '' : message, {
        signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted || isClosedReadlineError(error)) {
        throw new PromptCancelledError()
      }

      throw error
    } finally {
      this.activeQuestion = undefined

      if (secret) {
        this.mutedOutput.muted = false
        this.output.write('\n')
      }
    }
  }
}

class MutedOutput extends Writable {
  muted = false

  constructor(private readonly destination: NodeJS.WritableStream) {
    super()
  }

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (!this.muted) {
      this.destination.write(chunk)
    }

    callback()
  }
}

function isClosedReadlineError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    error.code === 'ERR_USE_AFTER_CLOSE'
  )
}
