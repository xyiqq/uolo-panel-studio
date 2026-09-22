# 配电工坊 V5

全屋配电三维装配与施工文档工具。可 `npm run build` 产出**单文件离线 HTML**，也可 Docker 静态托管。

## 快速开始

```bash
npm install
npm test
npm run dev          # 开发
npm run build        # dist/index.html 单文件
npm run preview
```

Docker：

```bash
docker compose -f docker/docker-compose.yml up --build
# http://localhost:8080
```

## 口径

**条件性方案 · 非施工合格结论。** 须由持证人员按现场与厂家手册深化。

## 阶段状态

当前完成范围、限制和下一阶段验收请以 [后续开发计划](docs/DEVELOPMENT_PLAN.md) 为准。以下阶段表仅表示已建立相应模块，不代表原规格所有任务已完成。

| 阶段 | 内容 |
|------|------|
| P0 | Vite 工程、领域黄金回归、UI、Studio3D |
| P1 | Schema v3 迁移、智能产品目录（参数待核）、空间/总线 |
| P2 | 文档中心、系统图、标签、二维码 |
| P3 | BOM、检查单、交底包 ZIP |
| P4 | localStorage 适配、Docker/nginx |

基线文件 `配电工坊V4.html` 保留不覆盖。
