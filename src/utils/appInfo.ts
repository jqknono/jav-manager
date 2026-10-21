import fs from "fs";
import path from "path";
import { getPreferredConfigDirectory } from "./appPaths";

export const AppName = "JavManager";

export function getVersion(): string {
  const baseDir = getPreferredConfigDirectory();
  const packagePath = path.join(baseDir, "package.json");
  if (!fs.existsSync(packagePath)) {
    return "unknown";
  }
  const raw = fs.readFileSync(packagePath, "utf-8");
  if (!raw.trim()) {
    return "unknown";
  }
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "unknown";
}
