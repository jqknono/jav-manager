import fs from "fs";
import path from "path";
import open from "open";

export async function openContainingFolder(targetPath: string): Promise<void> {
  if (!targetPath) {
    return;
  }

  const resolved = path.resolve(targetPath);
  const stat = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
  const folder = stat && stat.isDirectory() ? resolved : path.dirname(resolved);
  await open(folder);
}
