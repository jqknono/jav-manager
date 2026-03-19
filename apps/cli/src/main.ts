import { runCliEntry } from "../../client/src/index";

void Promise.resolve(runCliEntry(process.argv.slice(2))).catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
