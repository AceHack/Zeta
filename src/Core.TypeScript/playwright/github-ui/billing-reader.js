import { withGitHubSession } from "./auth";
/**
 * Reads org-level GitHub billing/usage page and extracts Actions minutes used and limit.
 * Read-only; uses B-0317 auth + B-0318 session pattern.
 * Smallest safe slice: Actions minutes primary. Storage/packages reserved for future slices.
 */
export async function readOrgBillingUsage(options = {}) {
    const org = options.org ?? "Lucent-Financial-Group";
    const url = `https://github.com/organizations/${org}/settings/billing`;
    return withGitHubSession(async (session) => {
        await session.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        const html = await session.page.content();
        const lower = html.toLowerCase();
        if (lower.includes("you don't have permission") || lower.includes("insufficient")) {
            return {
                org,
                actions: { minutesUsed: 0, minutesLimit: null },
                error: "insufficient-permissions",
                rawExcerpt: html.substring(0, 200),
            };
        }
        if (!lower.includes("billing") || !lower.includes("actions")) {
            return {
                org,
                actions: { minutesUsed: 0, minutesLimit: null },
                error: "page-not-found",
                rawExcerpt: html.substring(0, 200),
            };
        }
        // Minimal safe extract for Actions minutes (common GitHub billing UI patterns)
        const actionsMatch = /actions[^<]*?(\d[\d,]*)\s*(?:of|\/)\s*(\d[\d,]*|unlimited)/i.exec(html) ??
            /minutes[^<]*?used[^<]*?(\d[\d,]*)/i.exec(html);
        if (!actionsMatch) {
            return {
                org,
                actions: { minutesUsed: 0, minutesLimit: null },
                error: "parse-error",
                rawExcerpt: html.substring(0, 300),
            };
        }
        const minutesUsedText = actionsMatch[1];
        if (!minutesUsedText) {
            return {
                org,
                actions: { minutesUsed: 0, minutesLimit: null },
                error: "parse-error",
                rawExcerpt: html.substring(0, 300),
            };
        }
        const minutesUsed = parseInt(minutesUsedText.replace(/,/g, ""), 10) || 0;
        let minutesLimit = null;
        if (actionsMatch[2] && actionsMatch[2].toLowerCase() !== "unlimited") {
            minutesLimit = parseInt(actionsMatch[2].replace(/,/g, ""), 10) || null;
        }
        return {
            org,
            actions: { minutesUsed, minutesLimit },
        };
    }, options);
}
