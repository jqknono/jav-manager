#!/usr/bin/env node
"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { build } = require("esbuild");
const manifest = require("../package.json");

// 内部 workspace 与语言 JSON 内联；第三方模块继续由 npm 安装，保持其资源查找方式。
async function main() {
  const root = path.resolve(__dirname, "..");
  const outdir = path.join(root, "runtime");
  await fs.rm(outdir, { recursive: true, force: true });
  await build({
    absWorkingDir: root,
    entryPoints: {
      cli: "apps/cli/src/main.ts",
      gui: "apps/gui/src/main.ts",
      core: "packages/core/src/index.ts",
    },
    outdir,
    outExtension: { ".js": ".cjs" },
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    external: Object.keys(manifest.dependencies),
    plugins: [{
      name: "shared-core-runtime",
      setup(builder) {
        // CLI/GUI 复用同一份 core，避免配置、服务和语言资源重复打包。
        builder.onResolve({ filter: /^@jav-manager\/core$/ }, () => ({
          path: "./core.cjs",
          external: true,
        }));
      },
    }],
    minify: true,
    legalComments: "inline",
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
