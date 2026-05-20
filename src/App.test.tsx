import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App alpha dashboard", () => {
  it("renders the desktop alpha spine and safety boundary copy", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Import -&gt; review -&gt; enable -&gt; preview -&gt; mount -&gt; inspect runs");
    expect(html).toContain("Import");
    expect(html).toContain("Switchboard");
    expect(html).toContain("Exposure");
    expect(html).toContain("Mount");
    expect(html).toContain("Runs");
    expect(html).toContain("not trusted or sandboxed");
    expect(html).toContain("Enabled is local exposure intent");
    expect(html).toContain("Readiness is Core preflight status");
    expect(html).toContain("Exposed tools are enabled and ready");
  });
});
