import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { PromptCancelledError } from '../src/cli/bootstrap-family-member.command.js'
import {
  PromptInputError,
  TerminalBootstrapPrompter,
} from '../src/cli/terminal-prompter.js'

function createTerminalHarness(interactive = true) {
  const input = new PassThrough() as PassThrough & { isTTY?: boolean }
  const output = new PassThrough() as PassThrough & { isTTY?: boolean }
  input.isTTY = interactive
  output.isTTY = interactive
  let visibleOutput = ''
  output.on('data', (chunk: Buffer) => {
    visibleOutput += chunk.toString('utf8')
  })
  const prompter = new TerminalBootstrapPrompter(input, output)

  return {
    input,
    prompter,
    get visibleOutput() {
      return visibleOutput
    },
  }
}

describe('TerminalBootstrapPrompter', () => {
  it('reports whether both streams are interactive terminals', () => {
    const interactive = createTerminalHarness(true)
    const nonInteractive = createTerminalHarness(false)

    expect(interactive.prompter.isInteractive).toBe(true)
    expect(nonInteractive.prompter.isInteractive).toBe(false)

    interactive.prompter.close()
    nonInteractive.prompter.close()
  })

  it('does not echo a secret answer', async () => {
    const harness = createTerminalHarness()
    const answer = harness.prompter.secret('PIN: ')

    harness.input.write('123456\n')

    await expect(answer).resolves.toBe('123456')
    expect(harness.visibleOutput).toContain('PIN: ')
    expect(harness.visibleOutput).not.toContain('123456')
    harness.prompter.close()
  })

  it('maps numeric role selections to approved roles', async () => {
    const harness = createTerminalHarness()
    const answer = harness.prompter.role('Role')

    harness.input.write('2\n')

    await expect(answer).resolves.toBe('PARENT')
    harness.prompter.close()
  })

  it('rejects an invalid role selection', async () => {
    const harness = createTerminalHarness()
    const answer = harness.prompter.role('Role')

    harness.input.write('9\n')

    await expect(answer).rejects.toBeInstanceOf(PromptInputError)
    harness.prompter.close()
  })

  it.each([
    { answer: 'y', expected: true },
    { answer: 'YES', expected: true },
    { answer: 'n', expected: false },
    { answer: '', expected: false },
  ])('maps confirmation answer "$answer"', async ({ answer, expected }) => {
    const harness = createTerminalHarness()
    const result = harness.prompter.confirm('Continue? ')

    harness.input.write(`${answer}\n`)

    await expect(result).resolves.toBe(expected)
    harness.prompter.close()
  })

  it('rejects unexpected confirmation input', async () => {
    const harness = createTerminalHarness()
    const answer = harness.prompter.confirm('Continue? ')

    harness.input.write('maybe\n')

    await expect(answer).rejects.toBeInstanceOf(PromptInputError)
    harness.prompter.close()
  })

  it('maps Ctrl+C to a controlled cancellation error', async () => {
    const harness = createTerminalHarness()
    const answer = harness.prompter.text('Name: ')

    harness.input.write('\u0003')

    await expect(answer).rejects.toBeInstanceOf(PromptCancelledError)
    harness.prompter.close()
  })
})
