import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderCircuitTable } from '../../src/view/documents/circuit-table.js';
import { renderWiringTable } from '../../src/view/documents/wiring-table.js';
import { renderAuditList } from '../../src/view/documents/audit-list.js';
import { renderChecklist } from '../../src/view/documents/checklist.js';
import { renderChannelList } from '../../src/view/documents/channel-list.js';
import { renderSmartModuleFaces } from '../../src/view/documents/smart-faces.js';
const dom = html => new JSDOM(html).window.document;
describe('交付表格可读性与信息完整性', () => {
  it('纵向回路表保留计算数值与单位并转义用户文字', () => {
    const html = renderCircuitTable({design:{circuits:[{id:'C01',name:'厨房<插座>',phase:'L1',length:20}]}, matches:{C01:{ib:12.5,p:2750,section:2.5,cable:'3芯',drop:1.7}}});
    const doc = dom(html);
    expect(doc.querySelectorAll('thead th')).toHaveLength(5);
    for (const text of ['12.50 A','2.75 kW','2.5 mm²','20 m','1.70 %','厨房<插座>']) expect(doc.body.textContent).toContain(text);
    expect(html).toContain('&lt;插座&gt;');
    expect(doc.querySelector('.doc-guide')).not.toBeNull();
  });
  it('接线表区分方案状态和现场状态，通信规格不冒充导线面积', () => {
    const html = renderWiringTable({net:{wires:[{id:'w1',from:'K1:BUS',to:'K2:BUS',class:'comms',section:'Cresnet 四芯线',connected:false}]}});
    expect(dom(html).querySelectorAll('thead th')).toHaveLength(4);
    expect(html).toContain('通信总线');
    expect(html).toContain('方案中未连接');
    expect(html).not.toContain('四芯线 mm²');
    expect(html).toContain('不代表现场已经接好');
  });
  it('校核级别中文呈现，不把无条目当成验收通过', () => {
    const html = renderAuditList({issues:[{level:'error',code:'TEST',text:'待修正 <参数>'},{level:'pending',text:'厂家确认'}]});
    expect(html).toContain('需要修正');
    expect(html).toContain('资料待确认');
    expect(html).toContain('&lt;参数&gt;');
    expect(renderAuditList()).toContain('不表示现场已验收');
  });
  it('只读检查单显示纸面记录状态，交互版本仍可编辑', () => {
    const design = {checklist:{'bi-cabinet':{checked:true,value:'已核对',by:'张工'}}};
    const printed = dom(renderChecklist({design}));
    expect(printed.querySelector('input')).toBeNull();
    expect(printed.body.textContent).toContain('☑');
    expect(printed.body.textContent).toContain('张工');
    expect(dom(renderChecklist({design,interactive:true})).querySelector('input[data-check="bi-cabinet"]').checked).toBe(true);
  });
  it('无模块时仍包含阅读帮助及清晰空状态', () => {
    expect(renderChannelList()).toContain('暂无模块');
    const faces = dom(renderSmartModuleFaces());
    expect(faces.querySelector('article.doc-page')).not.toBeNull();
    expect(faces.querySelector('.doc-guide')).not.toBeNull();
    expect(faces.body.textContent).toContain('未装入智能模块');
  });
});
