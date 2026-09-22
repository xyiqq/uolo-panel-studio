# 配电工坊接手文档

更新：2026-09-22。用于新对话继续开发；先读本文，再读 [开发计划](DEVELOPMENT_PLAN.md)。

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

- USMART尺寸按用户指定参照HDR-100-24N，接口位置仅示意，供电针脚和额定仍待厂家资料。
- DIN-DLI内置DALI电源，禁止外部并联；DIN-DALI-2当前没有INT/EXT设置入口，未确认外置模式不自动接外部DALI PSU。
- DIN-1DIM4/U4的Cresnet 0.6W是市电缺失时参数，不表示24V可直接给调光负载供电。
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
```

- 控制供电：HDR24可选K/D/DLI，DC与负载L/N分开，刷新持久化，DLI禁止外部DALI供电。
- 端子：44位排+十组端子，第一排空位可选，新端子无缝贴合；刷新、真实移动回调、碰撞拒绝均检查。
- 导出：PDF图片及PNG正交正视、进线示意隐藏、相机状态恢复及真实PNG按钮下载。
- 输出在.playwright-cli/，不提交。output/及docs/_smoke-*.png也为本地生成产物，不提交现场照片/PDF样张。
- scripts/audit-pdf-export.mjs需要Chrome和Poppler pdfinfo/pdftoppm；验证空方案、完整方案和网络控制方案。
- accept-delivery.cjs是Playwright page回调片段，不是直接node可执行入口；verify-delivery-files.mjs需要先生成.playwright-cli/acceptance-delivery.zip，并需要Chrome/Edge。优先使用npm test中的delivery-flow等可重复回归。

## 下一步

优先执行开发计划P1：有官网/厂家资料后补齐USMART供电、端口和目录参数，再扩展自定义产品字段。二维码网页等待用户另行启动；不要把它当成本轮遗留故障。产品参数不齐时先整理缺项和来源，不猜测。

## 新对话可直接粘贴

> 继续uolo-panel-studio。先读取docs/HANDOFF.md和docs/DEVELOPMENT_PLAN.md，检查当前分支、工作区和远端main；保留用户未提交改动。按P1先做产品参数与端口资料闭环。旧方案迁移已取消，二维码只预留未来独立网页接口；保持24V控制与负载市电分离、端子无缝紧邻、导出正视图且隐藏进线示意。完成后运行相关回归并写中文变更日志。
