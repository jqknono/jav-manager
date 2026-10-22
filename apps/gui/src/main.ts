import {
  createAppContext,
  extractOverrides,
  loadConfig,
  LocalizationService,
  parseGuiArgs,
} from "@jav-manager/core";
import { startGuiServer } from "./gui";

export function runGuiEntry(rawArgs: string[] = process.argv.slice(2)): void {
  const { overrides, remaining } = extractOverrides(rawArgs);
  const config = loadConfig(overrides);
  const loc = new LocalizationService(config.console.language);
  const context = createAppContext(config, loc);
  const gui = parseGuiArgs(remaining);

  context.services.telemetryService.trackStartup();
  startGuiServer(context, gui.port, gui.host);
}

void Promise.resolve(runGuiEntry(process.argv.slice(2))).catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
