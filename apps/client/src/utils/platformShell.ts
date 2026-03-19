import fs from "fs";
import path from "path";

type OpenModule = {
  default: (target: string) => Promise<unknown>;
};

let openModulePromise: Promise<OpenModule> | null = null;

function importOpenModule(): Promise<OpenModule> {
  if (!openModulePromise) {
    const dynamicImport = new Function("specifier", "return import(specifier);") as (specifier: string) => Promise<OpenModule>;
    openModulePromise = dynamicImport("open");
  }
  return openModulePromise;
}

export async function openContainingFolder(targetPath: string): Promise<void> {
  if (!targetPath) {
    return;
  }

  const resolved = path.resolve(targetPath);
  const stat = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
  const folder = stat && stat.isDirectory() ? resolved : path.dirname(resolved);
  const { default: open } = await importOpenModule();
  await open(folder);
}
