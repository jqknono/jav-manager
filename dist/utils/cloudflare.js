"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCloudflareChallengeHtml = isCloudflareChallengeHtml;
function isCloudflareChallengeHtml(body) {
    if (!body)
        return false;
    const s = body.toLowerCase();
    return (s.includes("just a moment") ||
        s.includes("_cf_chl_opt") ||
        s.includes("cdn-cgi/challenge-platform"));
}
