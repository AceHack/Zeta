import { describe, expect, test } from "bun:test";
import { classifyHost, parseRemoteUrl } from "./detect";
describe("classifyHost", () => {
    test("github.com → github", () => {
        expect(classifyHost("github.com")).toBe("github");
    });
    test("self-hosted github → github", () => {
        expect(classifyHost("github.enterprise.corp")).toBe("github");
    });
    test("gitlab.com → gitlab", () => {
        expect(classifyHost("gitlab.com")).toBe("gitlab");
    });
    test("self-hosted gitlab → gitlab", () => {
        expect(classifyHost("gitlab.company.io")).toBe("gitlab");
    });
    test("codeberg.org → codeberg", () => {
        expect(classifyHost("codeberg.org")).toBe("codeberg");
    });
    test("gitea instance → gitea", () => {
        expect(classifyHost("gitea.example.com")).toBe("gitea");
    });
    test("bitbucket.org → bitbucket", () => {
        expect(classifyHost("bitbucket.org")).toBe("bitbucket");
    });
    test("sr.ht → sourcehut", () => {
        expect(classifyHost("git.sr.ht")).toBe("sourcehut");
    });
    test("unknown host → unknown", () => {
        expect(classifyHost("custom-forge.internal")).toBe("unknown");
    });
    test("case insensitive", () => {
        expect(classifyHost("GitHub.COM")).toBe("github");
        expect(classifyHost("GitLab.Com")).toBe("gitlab");
    });
});
describe("parseRemoteUrl", () => {
    test("SSH URL without .git suffix", () => {
        const result = parseRemoteUrl("git@github.com:Lucent-Financial-Group/Zeta");
        expect(result).toEqual({ host: "github.com", owner: "Lucent-Financial-Group", repo: "Zeta" });
    });
    test("SSH URL with .git suffix", () => {
        const result = parseRemoteUrl("git@github.com:org/repo.git");
        expect(result).toEqual({ host: "github.com", owner: "org", repo: "repo" });
    });
    test("HTTPS URL without .git suffix", () => {
        const result = parseRemoteUrl("https://github.com/Lucent-Financial-Group/Zeta");
        expect(result).toEqual({ host: "github.com", owner: "Lucent-Financial-Group", repo: "Zeta" });
    });
    test("HTTPS URL with .git suffix", () => {
        const result = parseRemoteUrl("https://gitlab.com/team/project.git");
        expect(result).toEqual({ host: "gitlab.com", owner: "team", repo: "project" });
    });
    test("HTTP URL (non-TLS)", () => {
        const result = parseRemoteUrl("http://gitea.local/user/repo.git");
        expect(result).toEqual({ host: "gitea.local", owner: "user", repo: "repo" });
    });
    test("self-hosted SSH", () => {
        const result = parseRemoteUrl("git@gitlab.corp.io:platform/backend.git");
        expect(result).toEqual({ host: "gitlab.corp.io", owner: "platform", repo: "backend" });
    });
    test("unparseable URL returns null", () => {
        expect(parseRemoteUrl("not-a-url")).toBeNull();
        expect(parseRemoteUrl("")).toBeNull();
        expect(parseRemoteUrl("/local/path/to/repo")).toBeNull();
    });
    test("file protocol returns null", () => {
        expect(parseRemoteUrl("file:///home/user/repo.git")).toBeNull();
    });
});
