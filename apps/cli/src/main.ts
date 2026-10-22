import {
  createAppContext,
  extractOverrides,
  filterGuiArgs,
  loadConfig,
  LocalizationService,
} from "@jav-manager/core";
import { isLightweightCliCommand, runCli } from "./cli";

export async function runCliEntry(rawArgs: string[] = process.argv.slice(2)): Promise<void> {
  const { overrides, remaining } = extractOverrides(rawArgs);
  const config = loadConfig(overrides);
  const loc = new LocalizationService(config.console.language);
  const context = createAppContext(config, loc);
  const cliArgs = filterGuiArgs(remaining);

  if (!isLightweightCliCommand(cliArgs)) {
    context.services.telemetryService.trackStartup();
  }
  await runCli(context, cliArgs);
}

void Promise.resolve(runCliEntry(process.argv.slice(2))).catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
