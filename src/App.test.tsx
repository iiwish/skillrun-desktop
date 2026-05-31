import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App alpha dashboard", () => {
  it("renders the redesigned Chinese-first dashboard and safety boundary copy", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Capsule 管理");
    expect(html).toContain("扫描本机已登记 Capsule");
    expect(html).toContain("团队库");
    expect(html).toContain("团队能力库");
    expect(html).toContain("导入 .skr");
    expect(html).toContain("Capsule 管理");
    expect(html).toContain("客户端挂载");
    expect(html).toContain("工具暴露");
    expect(html).toContain("执行记录");
    expect(html).toContain("设置");
    expect(html).toContain("EN");
    expect(html).toContain("还没有 Capsule");
    expect(html).toContain("左侧列表选择一个 Capsule");
  });
});
