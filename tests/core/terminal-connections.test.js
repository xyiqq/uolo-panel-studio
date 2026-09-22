import {it,expect} from 'vitest';
import {createBlankDesign, snapshotDesignTemplate, materializeTemplate} from '../../src/data/design-templates.js';
import {migrateV2ToV3} from '../../src/core/schema/migrate.js';
import {buildHandoverFiles} from '../../src/core/handover.js';
import {findProduct,validateDesign,buildAssembly} from '../../src/core/domain.js';
import {normalizeModule,validateHardwareId,validateIpAddress,isNetworkModule,moduleAddressMode,visibleModuleAddress,setModuleAddressMode} from '../../src/core/modules.js';
import {terminalRows,saveTerminalRows,terminalWireSegments,terminalCsv} from '../../src/core/terminal-connections.js';
import {terminalConnectionSvg} from '../../src/view/terminal-connections.js';
import {buildPortTemplates} from '../../src/core/ports.js';
import {moduleFaceSvg} from '../../src/view/module-face.js';
import {moduleFaceScene} from '../../src/view/module-face.js';
import {renderSmartModuleFaces} from '../../src/view/documents/smart-faces.js';
function fixture(){
 const d=createBlankDesign();
 d.modules=[['T1','phoenix-pt25-gy-4'],['K1','tuya-relay-4ch']].map(([id,productId])=>normalizeModule({id,productId},findProduct(d,productId)));
 return d;
}
it('Chinese remarks persist independently of addresses and are escaped in SVG',()=>{
 const d=fixture(),p=findProduct(d,'crestron-din-dali-2');
 d.modules=[normalizeModule({id:'GW1',productId:p.id,displayName:'客厅灯光网关',hardwareId:'02',ipAddress:'192.168.0.15'},p)];
 const restored=materializeTemplate(snapshotDesignTemplate(d,'备注模板'));
 expect(restored.modules[0].displayName).toBe('客厅灯光网关');
 const svg=renderSmartModuleFaces({assembly:buildAssembly(restored)});
 expect(svg).toContain('客厅灯光网关');expect(svg).toContain('#f5cf69');
 expect(moduleFaceSvg({...p,displayName:'<script>'})).not.toContain('<script>');
 const scene=moduleFaceScene({...p,faceRole:'module-note',displayName:'客厅灯光网关'},300,50);
 expect(scene.shapes.some(s=>s.text==='客厅灯光网关')).toBe(true);
});
it('gateway IP supports valid IPv4/IPv6, clearing and persisted SVG',()=>{
 expect(validateIpAddress('192.168.1.100')).toBe('192.168.1.100');
 expect(validateIpAddress('2001:db8::1')).toBe('2001:db8::1');
 expect(validateIpAddress('')).toBe('');
 for(const ip of ['999.1.1.1','abc','1.2.3','192.168.1.1:80']) expect(()=>validateIpAddress(ip)).toThrow();
 expect(isNetworkModule({kind:'gateway',protocol:['dali']})).toBe(true);
 expect(isNetworkModule({kind:'gateway',protocol:['rs485']})).toBe(true);
 const d=fixture(),p=findProduct(d,'crestron-din-dali-2');
 d.modules=[normalizeModule({id:'GW1',productId:p.id,ipAddress:'192.168.1.100'},p)];
 const loaded=materializeTemplate(snapshotDesignTemplate(d,'网关模板'));
 expect(loaded.modules[0].ipAddress).toBe('192.168.1.100');
 expect(renderSmartModuleFaces({assembly:buildAssembly(loaded)})).toContain('192.168.1.100');
});
it('hex instance IDs retain leading zeros and remain distinct on SVG documents',()=>{
 const d=fixture(),p=findProduct(d,'tuya-relay-4ch');
 const a=normalizeModule({id:'K1',productId:p.id,hardwareId:'01'},p);
 const b=normalizeModule({id:'K2',productId:p.id,hardwareId:'0e'},p);
 expect(a.hardwareId).toBe('01');expect(b.hardwareId).toBe('0E');
 expect(moduleFaceSvg({...p,hardwareId:b.hardwareId})).toContain('ID 0E');
 const svg=renderSmartModuleFaces({assembly:{nodes:[{id:a.id,product:p,module:a},{id:b.id,product:p,module:b}]}});
 expect(svg).toContain('ID 01');expect(svg).toContain('ID 0E');
 expect(normalizeModule({...a,hardwareId:'GG'},p).hardwareId).toBe('');
});
it('hardware IDs are case-insensitively unique, allow self-edit and release on clearing',()=>{
 const d=fixture();d.modules[1].hardwareId='0E';d.modules[1].addressMode='id';
 expect(()=>validateHardwareId(d,'K2','0e')).toThrow('已被 K1');
 expect(validateHardwareId(d,'K1','0e')).toBe('0E');
 expect(()=>validateHardwareId(d,'K2','GG')).toThrow('两位十六进制');
 d.modules[1].hardwareId=validateHardwareId(d,'K1','');
 expect(validateHardwareId(d,'K2','0E')).toBe('0E');
});
it('independent slices preserve binding across JSON validation and module editing',()=>{
 const d=fixture(), resolve=id=>findProduct(d,id), rows=terminalRows(d,resolve);
 rows[0]={...rows[0],output:'K1:CH1_OUT',loadName:'客厅灯',section:'1.5'};
 rows[1]={...rows[1],output:'K1:CH2_OUT',loadName:'窗帘上行',loadType:'motor'};
 saveTerminalRows(d,rows,resolve);
 const restored=validateDesign(JSON.parse(JSON.stringify(d)));
 expect(terminalRows(restored,resolve)[0].output).toBe('K1:CH1_OUT');
 expect(normalizeModule(restored.modules[0],resolve(restored.modules[0].productId)).terminalConnections[2].loadType).toBe('motor');
 const segments=terminalWireSegments(restored,buildAssembly(restored),resolve);
 expect(segments).toHaveLength(2);
 expect(segments[0].field.y).toBeGreaterThan(segments[0].target.y);
 expect(segments[0].field.x).not.toBe(segments[1].field.x);
 expect(terminalRows(materializeTemplate(snapshotDesignTemplate(restored,'接线模板')),resolve)[1].output).toBe('K1:CH2_OUT');
 expect(migrateV2ToV3(restored).modules[0].terminalConnections[1].loadName).toBe('客厅灯');
 expect(buildHandoverFiles({design:restored})['端子连接.csv']).toContain('K1:CH1_OUT');
});
it('duplicate output is rejected atomically and missing output is rejected',()=>{
 const d=fixture(),resolve=id=>findProduct(d,id),rows=terminalRows(d,resolve);
 rows[0].output=rows[1].output='K1:CH1_OUT';
 expect(()=>saveTerminalRows(d,rows,resolve)).toThrow('已连接');
 expect(d.modules[0].terminalConnections).toEqual({});
 rows[1].output='missing:CH1_OUT';
 expect(()=>saveTerminalRows(d,rows,resolve)).toThrow('不存在');
});
it('SVG and CSV escape user names and formulas',()=>{
 const rows=[{terminalId:'T1',pole:1,loadName:'<script>alert(1)</script>',wireNo:'=1+1'}];
 expect(terminalConnectionSvg(rows)).not.toContain('<script>');
 expect(terminalCsv(rows)).toContain("'=1+1");
});
it('terminal top is FIELD and bottom is PANEL',()=>{
 const p=findProduct(fixture(),'phoenix-pt25-gy-4');
 const ports=buildPortTemplates(p);
 expect(ports.find(p=>p.key==='FIELD1').side).toBe('top');
 expect(ports.find(p=>p.key==='PANEL1').side).toBe('bottom');
});

it('address modes infer legacy data, retain hidden values and reject reactivation conflicts',()=>{
 expect(moduleAddressMode({hardwareId:'01'})).toBe('id');
 expect(moduleAddressMode({ipAddress:'10.0.0.1'})).toBe('ip');
 expect(moduleAddressMode({hardwareId:'01',ipAddress:'10.0.0.1'})).toBe('both');
 const d=fixture();const m=d.modules[1];m.hardwareId='01';m.ipAddress='10.0.0.1';
 setModuleAddressMode(d,'K1','both');
 setModuleAddressMode(d,'K1','none');
 expect(visibleModuleAddress(m)).toEqual({hardwareId:'',ipAddress:''});
 expect(m.hardwareId).toBe('01');expect(m.ipAddress).toBe('10.0.0.1');
 const tpl=materializeTemplate(snapshotDesignTemplate(d,'地址模板'));
 expect(tpl.modules[1].addressMode).toBe('none');expect(tpl.modules[1].hardwareId).toBe('01');
 d.modules.push({...m,id:'K2',addressMode:'id'});
 expect(()=>setModuleAddressMode(d,'K1','both')).toThrow('已被 K2');
 expect(m.addressMode).toBe('none');
 d.modules.pop();setModuleAddressMode(d,'K1','both');
 expect(visibleModuleAddress(m)).toEqual({hardwareId:'01',ipAddress:'10.0.0.1'});
});
