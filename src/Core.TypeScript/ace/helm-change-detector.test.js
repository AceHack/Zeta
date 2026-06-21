import { describe, expect, it, mock, afterEach } from "bun:test";
import { fetchLatestVersion } from "./helm-change-detector";
describe("Helm Upstream Change Detector", () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
        globalThis.fetch = originalFetch;
    });
    it("should successfully fetch and return the latest semver version of a chart", async () => {
        const mockYaml = `
apiVersion: v1
entries:
  my-chart:
    - version: 1.0.0
    - version: 1.2.3
    - version: 1.1.0
    - version: invalid-semver
`;
        globalThis.fetch = mock(() => Promise.resolve(new Response(mockYaml, {
            status: 200,
            statusText: "OK",
        })));
        const latest = await fetchLatestVersion("https://example.com/charts", "my-chart");
        expect(latest).toBe("1.2.3");
    });
    it("should throw an error for OCI repository URLs", async () => {
        await expect(fetchLatestVersion("oci://registry-1.docker.io/bitnamicharts", "redis")).rejects.toThrow("OCI registries are not supported. Only standard HTTP/HTTPS Helm repositories are supported.");
    });
    it("should handle trailing slashes in repository URL correctly", async () => {
        const mockYaml = `
apiVersion: v1
entries:
  test-chart:
    - version: 2.5.1
`;
        let fetchedUrl = "";
        globalThis.fetch = mock((url) => {
            fetchedUrl = url;
            return Promise.resolve(new Response(mockYaml, {
                status: 200,
                statusText: "OK",
            }));
        });
        const latest = await fetchLatestVersion("https://example.com/charts/", "test-chart");
        expect(fetchedUrl).toBe("https://example.com/charts/index.yaml");
        expect(latest).toBe("2.5.1");
    });
    it("should throw an error if the HTTP fetch fails", async () => {
        globalThis.fetch = mock(() => Promise.resolve(new Response("", {
            status: 404,
            statusText: "Not Found",
        })));
        await expect(fetchLatestVersion("https://example.com/charts", "my-chart")).rejects.toThrow("Failed to fetch Helm repository index from https://example.com/charts/index.yaml: Not Found");
    });
    it("should throw an error if the chart is not found in the index", async () => {
        const mockYaml = `
apiVersion: v1
entries:
  other-chart:
    - version: 1.0.0
`;
        globalThis.fetch = mock(() => Promise.resolve(new Response(mockYaml, {
            status: 200,
            statusText: "OK",
        })));
        await expect(fetchLatestVersion("https://example.com/charts", "my-chart")).rejects.toThrow("Chart 'my-chart' not found in repository index");
    });
    it("should throw an error if no valid semver versions are found", async () => {
        const mockYaml = `
apiVersion: v1
entries:
  my-chart:
    - version: v1
    - version: latest
`;
        globalThis.fetch = mock(() => Promise.resolve(new Response(mockYaml, {
            status: 200,
            statusText: "OK",
        })));
        await expect(fetchLatestVersion("https://example.com/charts", "my-chart")).rejects.toThrow("No valid semver versions found for chart 'my-chart'");
    });
});
