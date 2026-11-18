# 配电工坊后续开发计划

更新于 2026-11-19。本文件与 [接手文档](HANDOFF.md) 描述当前状态，阶段日志用于追溯。

## 已完成，本轮不再重复开发

- 三个可选工具（电气校核、总线编辑、强弱电分排）完成验收及问题修复；补齐尺寸、保护、负载、零线、总线预算与未知参数提示。
- 配线、系统图、端子接线、接线表、CSV、号码管和BOM使用一致交付数据；导出修订、日期和签认、ZIP快照、离线HTML流程完成。
- PDF正文统一A4纵向、分页和通俗说明；标签纸采用独立打印纸型。BOM采用通用物料描述，不强塞具体设备参数。
- 项目设置录入公司名称、项目地址、现场实拍；封面标注箱体宽×高×深，图片页包含软件正视图及上传的现场照片。
- 导出PNG和PDF中的三维图固定正交正视；进线电源示意块、标题与引入示意线统一隐藏。此要求覆盖之前的显示开关方案。
- USMART DIN-TCP 1LAN+2RS485 / 1LAN+4RS485、明纬HDR-100-12N/24N已加入；DLP-04R完善，保留旧型号兼容。
- 官网核实Crestron控制侧24V/PoE，与继电器、调光和电机负载侧市电分离；电源下端可多选模块，接线与交付同步。
- 真实宽度占位替代端子整模位虚占；同排连续灰蓝端子必须紧邻，保存、刷新、拖拽及导出一致。
- 交换机多行文字使用一致字号。

## 已决定的范围边界

- **取消旧方案迁移**：不新增V2/V3迁移项目，不搬迁本地存储，不删除既有用户方案。已有兼容代码保留。
- 多方案管理、云端同步、报价、多用户权限不属于本批完成范围。
- 二维码仅预留用户未来按项目部署的HTTPS网页入口；没有配置有效公网HTTPS地址时不生成纯文本或无效二维码。当前软件没有托管项目网页。
- DIN-DLI 只使用内置 DALI 电源。DIN-DALI-2 由整机 INT／EXT 拨档决定两路 DALI 的供电方式，Cresnet 24V／PoE 单独为控制器供电。
- USMART 标称 24VDC 来自用户实物确认。输入范围、功耗、针脚和 RS-485 电气参数继续待核。

## 下一阶段建议顺序

### P1：产品参数和端口资料闭环

自定义产品编辑器已加入控制和负载供电、通道额定、整机功耗、预算消耗、PSU 输出和资料字段。目录已加入有据可查的 HQP7-1/-2、QSPS-DH-1-75/-H、DIN-4DIMU4（6513187）、Lunatone 24033444 及 ABB DG/S 1.64.5.1、2.64.5.1。Tridonic DALI PS2 已补齐输出额定。完整型号可主动选用，旧方案继续按原 ID 打开。[P1 来源清单](PRODUCT_SOURCES_P1.md)

1. USMART 两款 DIN-TCP 仍需厂家资料确认输入范围、功耗、RS-485 针脚和电气参数。
2. MDT SCN-DALI64 仍需实物完整型号与装配尺寸。涂鸦/DDS238-2 仍需 OEM 厂家和准确版本。
3. 后续每次录入须覆盖资料追溯、电压和预算反例、实际端口、旧方案打开及画面与 PDF/CSV 接线的一致性。

### P2：完善有依据的总线连接

- DIN-4DIMU4（6513187）已支持四路独立馈电。简易和完整模式均按通道选择独立的 220V 单相支路，可分别使用 L1、L2 或 L3。每路 L/N 从自己的保护路径引入，DIM 和 N 分别接对应负载，NET 24/G 独立接控制电源。方案包含移除出厂 L/N 共接跳线的条件。
- DIN-4DIMU4 已支持相邻通道的输出桥接。厂家配置码 `1100`、`0011`、`1110`、`1111`、`1122` 可生成 L/N/D 跨接，每个组由同一受保护的 220V 单相支路馈电。非相邻配置 `1010`、`1001`、`1101` 的跨接件待厂家确认，方案保留为待核草案。[安装手册 9454A，第 19、22–23、26 页](https://www.crestron.com/getmedia/9eac9402-8522-46f1-950a-2da68acc4c16/mg_pm_din-4dimu4)
- DIN-AP4 可用两个实体 NET 插座直连最多两台 DIN-4DIMU4（6513187）。每台调光器的第一组 NET 接独立控制电源的 24/G，第二组接主机的 Y/Z/G。[Cresnet 接线指南](https://docs.crestron.com/en-us/9272/Content/Topics/Cresnet-Wiring.htm)
- 三台及以上可在「配置 Cresnet 总线」选择专用 DIN-PWS50。主机至电源接 Y/Z/G，电源至首台和各台之间按成员顺序接 24/Y/Z/G。每台占用 3.6 W，按 50 W 总额定最多可供 13 台，实际数量还受供电距离和网段总长约束。负载侧逐路 L/N/D 独立建模。[DIN-PWS50 安装指南](https://www.crestron.com/getmedia/166679df-4a5a-4747-a051-660547945fe1/mg_ig_din-pwS50_1) · [Cresnet 供电与线长](https://docs.crestron.com/en-us/9272/Content/Topics/Power-Considerations.htm)
- DIN-AP4 现在可以混接 DIN-8SW8-I、DIN-4DIMFLV4、DIN-2MC2、DIN-1DIM4、DIN-1DIMU4、DIN-DALI-2、DIN-DLI 和 6513187。直连时各成员单配控制电源，使用 DIN-PWS50 时按顺序串接并合计实际型号的功耗。DIN-DALI-2 更改拨档后重新计算整段预算。[Crestron Cresnet 供电说明](https://docs.crestron.com/en-us/9272/Content/Topics/Power-Considerations.htm)
- DIN-AP4 的 COM1 可按顺序接 SDM630-Modbus V2。标识按两端厂家定义，保留公共参考、全线长度和两端终端电阻说明。同一电表不能同时分配给两台主机。USMART DIN-TCP 保留实物可见的接口和标称 24 V，RS-485 针序仍待厂家资料。[Crestron COM 引脚表](https://docs.crestron.com/en-us/8559/Content/Topics/Installation/DIN-AP4-Installation.htm) · [Eastron 协议与 A/B 波形，第 2.3 节](https://www.eastroneurope.com/images/uploads/products/protocol/SDM630_MODBUS_Protocol.pdf)
- DIN-DALI-2 在模块编辑器中保存整机 DALI POWER 拨档。INT 时两路均使用内置电源，EXT 时每路可选择独立的 DALI 电源输出，缺电源或冲突时按回路提示待核。控制器通过 Cresnet 供电时，整机预算分别为 9 W 和 2 W。[Crestron 规格书，第 2 页](https://www.crestron.com/getmedia/343cdb15-9139-446c-ae7f-bf6d915f2e8b/ss_din-dali-2)
- HQP7-1/-2 可配置 QS 链路、QSPS-DH-1-75-H 处理器线束、独立现场供电组及处理器间以太网级联。LQSE-4S10-D、4T10-D、4M-D、2DAL-D 按完整型号配置。现场组可分别录入 PDU、电流、设备和输出数。[Lutron 线束安装图 1B](https://assets.lutron.com/a/documents/037260_ENG_WEB.pdf)[Lutron HQP7 规格与接线图](https://assets.lutron.com/a/documents/3691127_ENG.pdf)
- ABB DG/S 1.64.5.1、2.64.5.1 支持交流输入、KNX 和独立 DALI A/B 现场端子，每路按 160 mA 保证电流和 64 个设备预算。Crestron DIN-DLI、DIN-DALI-2 及 Lutron LQSE-2DAL-D 的出箱端子和电源容量随具体型号确定。[ABB 原厂技术规格](https://library.e.abb.com/public/dceb931398e54dbea70af86238a849e3/DGS_x6451_TD_en_V1-0_2CDC507175D0211_Rev_A.pdf) · [Crestron DIN-DLI](https://docs.crestron.com/en-us/9406/Content/Topics/Specifications/Specifications.htm) · [Lutron 双回路接线图](https://assets.lutron.com/a/documents/369-650_ENG.pdf)
- 多级干接点链按用户填写的次序串联；共享输入、逐路输入和电机方向端子按型号处理。DIN-4DIMFLV4 和 LQSE-4T10-D 的 0–10 V 两芯分别占用现场灰端子，逐路录入驱动器供流／吸流方向和总毫安数。前者每路可吸流 60 mA，后者可供流或吸流 50 mA。三相四线直入式 SDM630-Modbus V2 计量三相和 N，PE 绕过电表。多表时逐台填写连续级次；缺级、逆序或跨馈线重复占用会中止该计量链。[DIN-4DIMFLV4 接线](https://docs.crestron.com/en-us/9507/Content/Topics/Installation/Connections-DIN-4DIMFLV4.htm) · [Eastron 三相四线接线图](https://www.eastrongroup.com/eastrongroup/2024/08/10/eastronsdm630seriesdinrailmounted;threephase;100adatasheet.pdf)
- DIN-4DIMU4 的 `1010`、`1001`、`1101` 继续保留为厂家逻辑组合。实体跨接件及其适用接法待核，方案中提示待核并抑制该组负载接线。[Crestron 产品手册 9454A](https://www.crestron.com/getmedia/9eac9402-8522-46f1-950a-2da68acc4c16/mg_pm_din-4dimu4)
- 验收：冲突来源与不确定参数可见，不自动并联电源；系统图、接线表、交付包一致。

### P3：项目二维码网页（待用户另行启动）

- 用户将单独建设按项目管理的网页；届时接通现有qrProjectUrl接口，并约定项目ID、修订版和回路c参数。
- 明确访问权限、发布更新方式和历史版本，不把本地JSON误认为已在线托管。
- 验收：微信/iOS/Android实机扫码打开HTTPS详情页；项目不存在、无权访问、旧版本、回路定位有明确反馈。

### P4：现场交付与发布验收

- 用真实项目照片和数据检查PDF整包、实体标签纸1:1打印、客户手机打开离线HTML及扫码网页。
- Docker/正式环境部署作为独立任务执行；合并PR不等于已经部署。
- 验收：打印边距与尺寸正确、照片比例不变、修订一致，现场设备参数由工程人员核实。

### P5：渐进维护

- 小步拆分压缩的domain/app/studio实现，逐步去除过渡别名；每次保持黄金回归和交付链路测试。
- 不为重构改动用户已确认的布局、端子贴合、控制/负载分离或导出行为。

## 验证入口

- 原交接基线：52个测试文件、316项；本次新增产品来源、自定义参数及 PSU 预算回归。运行 npm test；npm run build，最新结果见本次中文变更日志。
- 已保存浏览器回归：scripts/check-control-power.mjs、check-terminal-adjacency.mjs、check-front-export.mjs。
- `node scripts/check-din-4dimu4.mjs` 比对四路 L/N/D 与 NET 24/G 在装配画面、接线页、实际 PDF 及交付 CSV 中的 18 条连接，涵盖实体灰色端子替换虚拟相线出口。
- `node scripts/check-din-4dimu4.mjs --bridge` 比对两组独立桥接及 NET 24/G 的 16 条连接，覆盖两组不同相位、灰色端子和非相邻组合待核。
- `node scripts/check-din-4dimu4.mjs --cresnet` 从总线编辑器选择主机及调光器，保存重开后核对三维画面、接线页、实际 PDF 和 CSV 中的 21 条连接。
- `node scripts/check-din-4dimu4.mjs --cresnet-chain` 配置一台 DIN-AP4、一台 DIN-PWS50 和三台调光器。保存重开后逐条比对 15 条 Cresnet 芯线、12 条负载侧接线和 3 条电源交流进线，覆盖三维画面、接线页、实际 PDF、直接下载和交付包内的 CSV。
- `node scripts/check-din-dali-2.mjs` 分别保存并重开 INT 和 EXT 方案，核对 9 W／2 W、24/G 控制侧、两路 DA+/DA− 及画面、PDF、CSV 中的实际连接。
- `node scripts/check-mixed-networks.mjs` 在同一台 DIN-AP4 上配置混合 Cresnet 与 COM1 电表，检查手机宽度、重复次序、保存重开、装配端点、PDF、CSV、ZIP 和断网打开交付 HTML。
- `node scripts/check-qs-link.mjs` 验证两台 HQP7、两种 QS 现场供电组、处理器之间的以太网和 0–10 V 出线。
- `node scripts/check-dali-field.mjs` 核对 ABB、Crestron、Lutron 的现场端子。DIN-DALI-2 的 EXT 方案覆盖 Lunatone、明纬及现场确认极性后的 Tridonic。
- `node scripts/check-crestron-loads.mjs` 验证干接点级次、模拟调光、电机方向、共用馈电和双表串联。强电侧四芯按电表级次进出，三相电表的通信顺序在 COM1 单独配置。
- 自定义产品端到端：scripts/check-custom-electrical.mjs（隔离浏览器；表单保存/刷新/编辑、非法额定、手机宽度、PSU预算与电压反例、PDF/CSV接线一致性）。
- PDF审计：scripts/audit-pdf-export.mjs；完整交付验收片段及后处理见scripts/accept-delivery.cjs、verify-delivery-files.mjs。
- 运行要求、文件定位和新对话提示见 [HANDOFF.md](HANDOFF.md)。现场打印、实机扫码、生产部署不是已完成项。
