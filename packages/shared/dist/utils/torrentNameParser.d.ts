import { UncensoredMarkerType } from "../models";
export declare function parseTorrentName(torrentName: string): {
    uncensoredType: UncensoredMarkerType;
    hasSubtitle: boolean;
};
export declare function normalizeJavId(javId: string): string;
export declare function isValidJavId(javId: string): boolean;
