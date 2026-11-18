# 配电工坊接手文档

更新于 2026-11-19。用于新对话继续开发，先读本文和 [开发计划](DEVELOPMENT_PLAN.md)。

本批交付PR：[PR #4](https://github.com/xyiqq/uolo-panel-studio/pull/4)。提交和合并状态以该链接为准。

## 项目与启动

- 仓库：https://github.com/xyiqq/uolo-panel-studio ，默认分支main。
- 本机目录：C:/Users/dazhazhang/uoloproject/uolo-panel-studio。
- 技术：Vite + 原生JS + Three.js；Vitest；Playwright；构建为单文件dist/index.html。
- 本地服务：npm run dev -- --host 127.0.0.1，通常http://127.0.0.1:5173/。先检查已有进程，避免重复启动或误换端口。
- 初次安装npm ci；验证npm test、npm run build。开发模式离线HTML导出读取最近构建的dist/index.html，代码变更后必须重新build。
- 用户方案保存在浏览器本地存储；不要清除浏览器数据或在用户实际会话里导入验收样例。测试使用隔离浏览器上下文。

## 本轮交付总结

交付流程已完成本轮范围：三工具验收、电气/空间校核、修订签认、标签纸和统一交付网络、PDF全页排版、公司/地址/箱体尺寸、正视方案图和现场实拍、二维码外部接口。另增加USMART两款接口模块和完整明纬型号，核实Crestron24V控制电源，修复端子真实空位和紧邻排列。

用户最终要求（覆盖同日早期日志）：

1. 旧方案迁移取消，不重新开启迁移或本地存储搬迁。
2. BOM不要求填写具体设备参数，交换机等采用合适通用描述。
3. 二维码未来指向用户另建的项目HTTPS网页；当前仅留接口，不输出微信不支持的纯文本二维码。
4. 公司名称、项目地址在项目信息与设计条件填写；现场照片上传，不用生成图代替现场实拍。
5. 导出三维方案图为正交正视，PNG与PDF一致；不再显示进线示意块、标题及其引入线。早先显示开关已移除。
6. 24V控制侧给模块本身供电，空开经过继电器/调光负载侧给灯具设备供电。二者端子和线路不可混用。
7. 同排连续灰蓝端子必须紧贴，整数模位锚点不能产生空隙或虚占；不可因贴合越过其他器件或绕过分排/PDU碰撞。

## 关键代码地图

| 模块 | 文件与约定 |
|---|---|
| 方案/装配 | src/core/domain.js；仍有压缩遗留实现；不要整文件格式化 |
| 实际占位 | modules.js compactModulePlacement；placement-footprint.js的occupied.footprints是运行期毫米边界，方案仍存整数row/slot |
| 控制与负载 | 产品powerInput为控制输入，loadPowerInput为负载输入；ports.js统一解析；module-feeds/module-wiring构建连线 |
| 电源下端选择 | core/psu-connections.js、ui/psu-connections.js；复用buses的psuModuleIds/deviceModuleIds |
| 产品资料 | data/products/smart-crestron.js、smart-usmart.js、psu-meanwell.js；工厂须保留新增字段 |
| 项目与编辑窗口 | ui/app.js；项目资料/照片、模块编辑、安装位置入口 |
| 三维和导出 | view/terminal-studio3d.js captureDocumentImage；独立正交相机，finally恢复临时状态；screenshot复用正视导出 |
| PDF | view/documents/*、paginate.js、styles/documents.css；正文A4纵向，标签用独立纸型 |
| 交付网络 | core/delivery-net.js buildDeliveryNet(design,assembly,net)，不能漏传后两项；handover、labels、bom-delivery |
| 导出协调 | ui/v5-bridge.js收集统一快照，修订/签认/ZIP/打印；standalone-html.js + vite.config.js内联离线模板 |
| 二维码 | view/qr.js：qrProjectUrl需公网HTTPS；回路追加c参数；core/design-link.js只定位本地匹配方案 |

## 必须保留的边界

- USMART 尺寸按用户指定参照 HDR-100-24N，24VDC 控制供电和 2/4 路布局由用户按实物确认。输入范围、功耗、RS-485 针脚与电气额定仍待厂家资料。[实物核查记录](2026-09-23-精绘USMART网转485模块.md)
- DIN-DLI 仅内置供电。选中 DIN-DALI-2 后编辑模块，在 DALI POWER 选择整机 INT 或 EXT。两路共用一个拨档。EXT 时按 DALI 1 和 DALI 2 各选一个总线电源，切回 INT 并保存会解除两路外源关联。旧方案未记录拨档时沿用 INT。Cresnet 供电的整机预算随拨档取 9 W 或 2 W，控制侧 24/G 继续在直流电源下端分配。[厂家规格书](https://www.crestron.com/getmedia/343cdb15-9139-446c-ae7f-bf6d915f2e8b/ss_din-dali-2)
- DIN-1DIM4/U4的Cresnet 0.6W是市电缺失时参数，不表示24V可直接给调光负载供电。
- DIN-4DIMU4（6513187）支持独立通道与相邻通道桥接。每个组使用自己的受保护 220V 单相支路，组内按厂家跨接 L/N/D，首路出 DIM，末路出 N。按实际组别调整出厂 L/N 跳线并设置设备模式，组间 L/N/D 保持隔离，NET 24/G 单独接控制电源。非相邻模式待确认适用跨接件。[Crestron 安装手册 9454A](https://www.crestron.com/getmedia/9eac9402-8522-46f1-950a-2da68acc4c16/mg_pm_din-4dimu4)
- 真实装配空间不等于温升或施工合格结论，未知散热、线径、额定保持待核。
- 端子连接为交付投影，不等于已经完成负载导通、电机互锁或各协议仿真。
- 保存位置是兼容锚点；端子实际x坐标可能因紧贴而与模位起点不同。不要重新用slot*18绘制它，也不要回退为ceil(modules)碰撞检查。
- 合并仓库不是生产部署。本轮没有Docker上线、实体纸张校准和手机实机扫码验收。

## 复现与验收

先npm run build并启动5173服务，安装Chrome后运行：

```powershell
npm test
node scripts/check-control-power.mjs
node scripts/check-terminal-adjacency.mjs
node scripts/check-front-export.mjs
node scripts/check-din-4dimu4.mjs
node scripts/check-din-4dimu4.mjs --bridge
node scripts/check-din-4dimu4.mjs --cresnet
node scripts/check-din-4dimu4.mjs --cresnet-chain
node scripts/check-din-dali-2.mjs
```

- 控制供电：HDR24可选K/D/DLI，DC与负载L/N分开，刷新持久化，DLI禁止外部DALI供电。
- 端子：44位排+十组端子，第一排空位可选，新端子无缝贴合；刷新、真实移动回调、碰撞拒绝均检查。
- 导出：PDF图片及PNG正交正视、进线示意隐藏、相机状态恢复及真实PNG按钮下载。
- DIN-4DIMU4 验收需 Chrome、Poppler 的 `pdfinfo`、`pdftoppm`，文本提取可用 `pdftotext` 或带 `pypdf` 的 Python。脚本从实际打印流程生成 PDF，核对 3D、画面接线表、PDF 和两个 CSV 下载入口。样本在 `.playwright-cli/din-4dimu4/` 与 `.playwright-cli/din-4dimu4-bridge/`。
- 输出在.playwright-cli/，不提交。output/及docs/_smoke-*.png也为本地生成产物，不提交现场照片/PDF样张。
- scripts/audit-pdf-export.mjs需要Chrome和Poppler pdfinfo/pdftoppm；验证空方案、完整方案和网络控制方案。
- accept-delivery.cjs是Playwright page回调片段，不是直接node可执行入口；verify-delivery-files.mjs需要先生成.playwright-cli/acceptance-delivery.zip，并需要Chrome/Edge。优先使用npm test中的delivery-flow等可重复回归。

## 下一步

在柜内选中 DIN-AP4、DIN-PWS50 或 DIN-4DIMU4（6513187），打开「配置 Cresnet 总线」。直连模式按成员顺序使用主机的两个 NET 插座，每台调光器的第二组 NET 接 Y/Z/G，第一组 24/G 单独分配控制电源。直连验收样张在 `.playwright-cli/din-4dimu4-cresnet/`。[DIN-AP4 规格](https://docs.crestron.com/en-us/8559/Content/Topics/Specifications/DIN-AP4-Specifications.htm)

三台及以上可选「DIN-PWS50 · 串接电源」，依次添加调光器，填写网段总长和电源至末台线长。主机 NET 至电源第一组 NET 接 Y/Z/G，电源第二组 NET 至首台第一组 NET 接 24/Y/Z/G，此后每台从第二组 NET 接到下一台第一组 NET。24/G 仅供控制侧使用，电源自身的交流进线及调光负载各有独立端子。`src/core/cresnet.js` 按 `chainSupplyModuleId` 和成员顺序生成连接，校核专用电源的 50 W 总额定、18 AWG 供电距离、网段长度与重复供电。三台样张和含方案 JSON 的交付包在 `.playwright-cli/din-4dimu4-cresnet-chain/`。[DIN-PWS50 安装指南](https://www.crestron.com/getmedia/166679df-4a5a-4747-a051-660547945fe1/mg_ig_din-pwS50_1) · [Cresnet 供电与线长](https://docs.crestron.com/en-us/9272/Content/Topics/Power-Considerations.htm) · [DIN-4DIMU4 产品手册](https://www.crestron.com/getmedia/9eac9402-8522-46f1-950a-2da68acc4c16/mg_pm_din-4dimu4)

P1 已完成自定义产品电气字段与来源编辑。2026-11-18 同步到包含 USMART 实物确认的远端主分支，并按官方资料增加 DIN-4DIMU4（6513187）、QSPS-DH-1-75-H、Lunatone 24033444 和两款 ABB DG/S Premium。DALI 电源预算采用 Lunatone 保证值 200mA，已核 ABB 网关拒绝外接 DALI 电源。[P1 来源清单](PRODUCT_SOURCES_P1.md)

自定义字段校验位于 `core/custom-product-electrical.js`，表单位于 `ui/custom-product-electrical.js`；`powerConsumptionW` 是整机输入功耗，不能冒充 `busConsumption` 或散热。新型号未知供电显式保存为 `unknown`；旧省略/null 字段保持兼容。PSU V/A/W 必须不互相矛盾。浏览器验证新增 `node scripts/check-custom-electrical.mjs`。

P2 的型号范围与厂家依据见[开发计划](DEVELOPMENT_PLAN.md)。在模块编辑器中配置 HQP7 链路、DIN-AP4 的 COM1 电表次序、DALI 现场出线和 0–10 V 端子。在总线编辑器中配置混合 Cresnet 的主机、专用电源及成员顺序。灰色端子的每一极只接受一项配线。同一控制器可同时使用已核实的 Cresnet 和 COM1 接口。

浏览器回归入口为 `scripts/check-mixed-networks.mjs`、`scripts/check-qs-link.mjs`、`scripts/check-dali-field.mjs`、`scripts/check-crestron-loads.mjs`。DIN-4DIMU4 的独立馈电、相邻桥接、直连和电源注入级联沿用 `scripts/check-din-4dimu4.mjs`。DIN-DALI-2 整机拨档沿用 `scripts/check-din-dali-2.mjs`。实测样张保存在本机 `.playwright-cli/` 各方案目录。非相邻跨接件、USMART 针脚及缺后缀的历史产品需按现场完整型号补资料。二维码网页等待用户另行启动。

## 新对话可直接粘贴

> 继续 uolo-panel-studio。先读 docs/HANDOFF.md 和 docs/DEVELOPMENT_PLAN.md，保留工作区内的改动。若收到对应产品的完整铭牌和厂家接线图，可补核资料清单中的针脚与跨接件。保持控制供电与负载市电分离，按实际端子比对保存重开的画面、PDF 与 CSV。
