import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App alpha dashboard", () => {
  it("renders the redesigned Chinese-first dashboard and safety boundary copy", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("本地 Skill Capsule 控制台");
    expect(html).toContain("Capsule 管理");
    expect(html).toContain("查看、筛选、启用或停用本机已登记的 Skill Capsule");
    expect(html).toContain("搜索 Capsule");
    expect(html).toContain("导入 .skr");
    expect(html).toContain("Capsule 管理");
    expect(html).toContain("客户端挂载");
    expect(html).toContain("工具暴露");
    expect(html).toContain("执行记录");
    expect(html).toContain("设置");
    expect(html).toContain("EN");
    expect(html).toContain("还没有 Capsule");
    expect(html).toContain("选择一个 Capsule 查看详情");
  });
});
