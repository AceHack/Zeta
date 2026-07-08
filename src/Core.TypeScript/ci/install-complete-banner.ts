const INSTALL_COMPLETE_BANNER_START = 'echo "  ZETA CLUSTER NODE INSTALL COMPLETE"';
const INSTALL_COMPLETE_BANNER_END = "081KSGS9H0008QG0R001RR3ZXQ install log preservation";

const REQUIRED_PASSWORD_COPY = "password: documented at install-time only; not shown";

export function extractInstallCompleteBannerSource(installerSource: string): string | null {
  const start = installerSource.indexOf(INSTALL_COMPLETE_BANNER_START);
  if (start === -1) return null;

  const end = installerSource.indexOf(INSTALL_COMPLETE_BANNER_END, start);
  if (end === -1) return installerSource.slice(start);

  return installerSource.slice(start, end);
}

export function installCompletePasswordDisclosureFailures(bannerSource: string): readonly string[] {
  const failures: string[] = [];
  const lines = bannerSource.split(/\r?\n/);

  if (!bannerSource.includes(REQUIRED_PASSWORD_COPY)) {
    failures.push(`missing required non-disclosure copy: ${REQUIRED_PASSWORD_COPY}`);
  }

  for (const [index, line] of lines.entries()) {
    const normalized = line.toLowerCase();
    if (normalized.includes("zeta-change-me")) {
      failures.push(`line ${index + 1}: discloses default password zeta-change-me`);
    }

    if (/\bpassword:\s*/i.test(line) && !normalized.includes(REQUIRED_PASSWORD_COPY)) {
      failures.push(`line ${index + 1}: password banner line does not use non-disclosure copy`);
    }
  }

  return failures;
}
