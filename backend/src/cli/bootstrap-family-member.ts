import { runBootstrapFamilyMemberCommand } from './bootstrap-family-member.command.js'
import { TerminalBootstrapPrompter } from './terminal-prompter.js'
import { SupabaseFamilyMemberBootstrapRepository } from '../repositories/family-member-bootstrap.repository.js'
import { FamilyMemberBootstrapService } from '../services/family-member-bootstrap.service.js'

const prompter = new TerminalBootstrapPrompter(process.stdin, process.stdout)

try {
  if (process.argv.length > 2) {
    process.stderr.write(
      'This command accepts member details only through interactive prompts.\n',
    )
    process.exitCode = 1
  } else {
    process.exitCode = await runBootstrapFamilyMemberCommand({
      prompter,
      createService: () =>
        new FamilyMemberBootstrapService(
          new SupabaseFamilyMemberBootstrapRepository(),
        ),
      write: (message) => process.stdout.write(`${message}\n`),
      writeError: (message) => process.stderr.write(`${message}\n`),
    })
  }
} finally {
  prompter.close()
}
