# P1 产品参数与来源核查

最后核查日期为 2026-11-18。额定值适用于资料中列出的完整型号和版本。

## 2026-11-18 目录更新

- **Crestron DIN-4DIMU4（物料号 6513187）**。Crestron 于 2026-11-04 发布该型号。机身宽 106、高 94、深 60mm，占 6M。通过 Cresnet 24VDC 供电，消耗 3.6W（150mA）。负载侧为 100–230VAC、50/60Hz，四路各有 L、N 输入和 DIM 输出。P2 支持独立馈电与相邻通道桥接。随附 L（2065817）、N（2065818）、DIM（2065819）跨接件适用相邻通道，非相邻厂商配置待核实物跨接方案。230VAC 下两路、三路、四路桥接分别标称 640、960、1280 W/VA，资料按电压列额定，软件未将 230V 数值用于 220V 方案校核。旧 12M 条目仍按原 ID 打开。[手册 9454A，第 9、14、19、22–23、26 页](https://www.crestron.com/getmedia/9eac9402-8522-46f1-950a-2da68acc4c16/mg_pm_din-4dimu4) · [SIMPL 配置码表](https://help.crestron.com/simpl/Content/Device_Library/Lighting/DIN-4DIMU4/Bridge%20Configuration.jpg)
- **Lutron QSPS-DH-1-75-H**。HQP7-1/-2 指定的带线束电源，机身 90×90×61mm、5M，输入 100–277VAC、50/60Hz，输出 24VDC±1%、2.5A。两组预装线束共用输出额定。75 PDU 是厂家配额，软件按标称输出折算为 60W，机身尺寸未含线束。[Lutron 369885d，第 1–5 页](https://assets.lutron.com/a/documents/369885_ENG_WEB.pdf) · [HQP7 3691127f，第 1–2、5 页](https://assets.lutron.com/a/documents/3691127_ENG.pdf)
- **Lunatone DALI-2 PS（24033444）**。尺寸图为 17.5×98×56.4mm（规格表深度取整为 56mm），占 1M。DALI 电压范围 12–20.5V，预算采用额定保证电流 200mA，最大电流 250mA。按正视图建模，上端从左到右为 DA+、DA−，下端从左到右为 N、L。[Lunatone D0077，2026-05-25，第 2–4 页](https://www.lunatone.com/wp-content/uploads/2018/03/24033444_DALI_PS_EN_D0077.pdf)
- **ABB DG/S 1.64.5.1 / 2.64.5.1**（订货号 2CDG110273R0011 / 2CDG110274R0011）。机身 70×90×63.5mm、4M，安装深度 68mm。分别内置一路、两路 DALI 电源，每路最大 250mA。软件按交流输入投影，两款都禁止在内置 DALI 输出并接外部电源。P2 已按 A/B 分路建模，每路按保证电流 160 mA 和 64 个设备预算。[ABB 技术规格，第 1–3、5–7 页](https://library.e.abb.com/public/dceb931398e54dbea70af86238a849e3/DGS_x6451_TD_en_V1-0_2CDC507175D0211_Rev_A.pdf) · [ABB 产品手册，第 4.4 节](https://library.e.abb.com/public/8591193b8fc9441c845fa56fc1bc0327/DGS_X6451_PH_EN_V2-1_9AKK107680A0534_Rev_C.pdf)

## 2026-09-22 目录更新

| 产品 | 官方依据 | 写入目录的内容 | 仍需注意 |
| --- | --- | --- | --- |
| Tridonic DALI PS2 / 28000876 | [官方技术资料](https://resources.tridonic.com/PDB/Ressource/GroupPdf/en/DALI_PS2_14303.pdf)，09/26-CO046-12，第 2–3 页 | 订货号；输出 13.5V、240mA；保留已核 36×89.5×56.8mm | 输入 220–240VAC；4.7W 为输入功率，未作为输出容量。DALI 非 SELV，不能作通用 DC 电源 |
| Lutron QSPS-DH-1-75 | [官方 369886f](https://assets.lutron.com/a/documents/369886_eng.pdf)，2021-12-01，第 1–4 页 | 新完整型号；90×90×61mm、5M；输出 24V/2.5A | 75 是 PDU 数，非瓦数；上下各留 30mm；不能给电动窗帘供电；不同电源正极不可互连；不是 -H 型号 |
| Lutron HQP7-1 / HQP7-2 | [官方 3691127f](https://assets.lutron.com/a/documents/3691127_ENG.pdf)，2025-08-06，第 1–2、4–5 页 | 新完整型号；108×100×60.5mm、6M（含端子高 100mm）；控制侧按受支持的 24VDC 接入 | 额定范围 24–36VDC，处理器 250mA；L1/L2 的 +24V 链路供电在 P2 按电源组建模。典型 4.2W 不当作最大预算。官方指定配套为 QSPS-DH-1-75-H |

HQP7 机身高度 90mm 与含端子高度 100mm 均在官方资料列出；装配目录用含端子的外形。旧 `lutron-hqp7` / `lutron-qs-link-psu` 保留原 ID 和尺寸，不自动替换用户已有型号；修正旧说明中容易误认为 HQP7 不能 DIN 安装的措辞。HQP7 完整型号的处理器供电、QS L1/L2、现场供电组及以太网串接已在 [P2](DEVELOPMENT_PLAN.md) 中实现。

## 未闭环项与所缺资料

| 项目 | 本次结论 | 继续推进所需资料 |
| --- | --- | --- |
| USMART DIN-TCP 1LAN+2RS485 / 1LAN+4RS485 | 2026-09-23 已按实物确认标称 24VDC、1 LAN 和 2/4 路 RS-485。外形仍参照 HDR-100-24N，端子按照片示意。[实物核查记录](2026-09-23-精绘USMART网转485模块.md) | 以 DIN-TCP 和旧面板称呼 IHS-TCP/IP 复查，仍缺匹配厂家资料。需要确切版本、输入范围、功耗、针脚、隔离、终端电阻、通信距离及 PoE 说明 |
| QS-Link-PSU / HQP7、Lunatone DALI-PS、ABB DG/S 旧条目 | 这些记录缺少完整型号或订货号。目录已有可选的完整型号，历史尺寸用于打开旧方案 | 对照项目实物确定准确版本，确认后手动替换 |
| MDT SCN-DALI64 | 官方 .03 规格列出 4TE、230VAC/50Hz、内置一路 DALI 供电，并明确禁止外接 DALI 电源。具体型号待用户现场确认。[MDT .03 规格第 1–2 页](https://www.mdt.de/download/MDT_DS_Dali_Control_Gateway_64_03.pdf) | 实物完整型号、可核对的机身高度与深度图 |
| 涂鸦 DIN / DDS238-2 等 | 涂鸦为平台，现条目不足以对应唯一 OEM 设备；Wi-Fi/Zigbee 不能据当前占位理解为同时支持；不更改未知额定 | OEM 厂家、完整型号/后缀、保护功能认证与脱扣参数、协议版本、接线图和外形图 |

## 代码与验证

- 目录文件位于 `src/data/products/`，本次涉及 `smart-crestron.js`、`smart-lutron.js` 和 `psu-dali.js`。
- `catalog-p1.test.js`、`other-catalog-specs.test.js` 和 `crestron-catalog.test.js` 覆盖型号、旧 ID、供电边界、预算和配线交付。
- 逐一落图、实体装配、散热和现场通电仍待验证。
