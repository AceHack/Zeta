// Type surface for the viewer's pure helpers (imported by proofs/viewer.unit.test.ts).
export interface ViewerItem {
  id: string; name: string; brand: string; model_pn: string; qty: number;
  device_type: string; category: string; status: string; location: string;
  assignment_purpose: string; value_usd: number; serial: string;
  acquired?: string; assigned_machine: string; sample: boolean; notes: string; file: string;
}
export declare const REPO_BLOB_BASE: string;
export declare function escapeHtml(s: unknown): string;
export declare function matchesQuery(item: ViewerItem, query: string): boolean;
export declare function filterItems(items: ViewerItem[], query: string, status: string): ViewerItem[];
export declare function compareItems(a: ViewerItem, b: ViewerItem, key: keyof ViewerItem, dir: "asc" | "desc"): number;
export declare function totals(items: ViewerItem[]): { count: number; value: number };
export declare function rowHtml(item: ViewerItem): string;
