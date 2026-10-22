import fs from "fs";
import path from "path";
import { getPreferredConfigDirectory } from "./appPaths";

export const AppName = "JavManager";

export function getVersion(): string {
  const packageInfo = findNearestPackageInfo();
  if (!packageInfo?.version) {
    return "unknown";
  }
  return packageInfo.version;
}

function findNearestPackageInfo(): { version?: string } | null {
  const candidates = [
    __dirname,
    path.dirname(process.argv[1] ?? process.execPath),
    getPreferredConfigDirectory(),
    process.cwd(),
  ];

  for (const startDir of candidates) {
    const packageInfo = findPackageJsonUpwards(startDir);
    if (packageInfo?.version) {
      return packageInfo;
    }
  }

  return null;
}

function findPackageJsonUpwards(startDir: string): { version?: string } | null {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, "package.json");
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, "utf-8");
      if (raw.trim()) {
        const parsed = JSON.parse(raw) as { version?: string };
        if (parsed.version) {
          return parsed;
        }
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
