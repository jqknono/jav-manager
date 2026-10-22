#!/usr/bin/env node

// 发布入口仅做模式选择；help/version 等命令优先进入 CLI。
const args = process.argv.slice(2);
const cliCommands = ["help", "h", "--help", "-h", "version", "v", "--version", "-v", "--id"];
const guiFlags = ["--gui", "--host", "--port", "--gui-host", "--gui-port"];
const useGui = !args.some((arg) => cliCommands.includes(arg)) && (
	args[0]?.toLowerCase() === "gui" ||
	args.some((arg) => guiFlags.includes(arg.split("=")[0]) || arg.startsWith("--gui-"))
);
require(useGui ? "../runtime/gui.cjs" : "../runtime/cli.cjs");
