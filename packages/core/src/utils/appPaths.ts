import fs from "fs";
import path from "path";

export function getPreferredConfigDirectory(): string {
  const override = process.env.JAVMANAGER_CONFIG_DIR;
  if (override && fs.existsSync(override)) {
    return override;
  }

  const execDir = path.dirname(process.argv[1] ?? process.execPath);
  const cwd = process.cwd();

  if (hasConfig(execDir)) {
    return execDir;
  }

  if (hasConfig(cwd)) {
    return cwd;
  }

  return execDir || cwd;
}

export function getAppSettingsPath(): string {
  return path.join(getPreferredConfigDirectory(), "appsettings.json");
}

function hasConfig(dir: string): boolean {
  const file = path.join(dir, "appsettings.json");
  return fs.existsSync(file);
}
