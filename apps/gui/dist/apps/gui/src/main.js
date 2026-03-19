"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../client/src/index");
void Promise.resolve((0, index_1.runGuiEntry)(process.argv.slice(2))).catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exit(1);
});
