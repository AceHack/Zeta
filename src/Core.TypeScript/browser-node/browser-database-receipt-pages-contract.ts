import { BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY } from "./browser-database-receipt-proposal";

export const BROWSER_DATABASE_RECEIPT_PAGES_INDEX_SCHEMA = "zeta.browser-database-receipt-pages-index.v1" as const;
export const BROWSER_DATABASE_RECEIPT_PAGES_DATA_ROOT = "data/browser-receipts" as const;
export const BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH =
  `${BROWSER_DATABASE_RECEIPT_PAGES_DATA_ROOT}/index.json` as const;
export const BROWSER_DATABASE_RECEIPT_PAGES_RECORD_ROOT =
  `${BROWSER_DATABASE_RECEIPT_PAGES_DATA_ROOT}/records` as const;

export interface BrowserDatabaseReceiptPagesIndexEntry {
  readonly targetPath: string;
  readonly byteLength: number;
}

export interface BrowserDatabaseReceiptPagesIndex {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_PAGES_INDEX_SCHEMA;
  readonly repository: typeof BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY;
  readonly ref: "main";
  readonly revision: string;
  readonly records: readonly BrowserDatabaseReceiptPagesIndexEntry[];
}
