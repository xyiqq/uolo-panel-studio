import {findProduct} from './domain.js';
import {terminalWireSegments, terminalRows} from './terminal-connections.js';

// 交付资料使用同一份连接清单；端子手工线不参与保护器导通仿真。
export function buildDeliveryNet(design, assembly, net) {
  const ports=Object.fromEntries(Object.entries(net?.ports||{}).map(([id,p])=>[id,{...p}]));
  const wires=(net?.wires||[]).filter(w=>!w.terminalConnection).map(w=>({...w}));
  const wiringIssues=[...(net?.wiringIssues||[])];
  const resolve=id=>findProduct(design,id);
  // 保留基础电气网用于重复构建，交付投影不应把同一相线同时画到虚拟X和实际T端子。
  const sourceNet=net?.deliverySource||net;
  const segments=terminalWireSegments(design,assembly||net?.assembly||{nodes:[]},resolve,sourceNet);
  const seen=new Set();
  for(const s of segments) {
    if(seen.has(s.output)) {
      wiringIssues.push({code:'TERMINAL_OUTPUT_DUPLICATE',level:'error',message:`${s.output} 重复连接，请检查端子 ${s.id}`});
      continue;
    }
    seen.add(s.output);
    const moduleId=s.output.split(':')[0],mod=design.modules?.find(m=>m.id===moduleId);
    const channel=Number(/:CH(\d+)_OUT$/.exec(s.output)?.[1]);
    const physicalOutput=s.physicalOutput||s.output;
    ports[physicalOutput] ||= {id:physicalOutput,node:physicalOutput.split(':')[0],key:physicalOutput.split(':')[1],conductor:'L1',side:'bottom',...s.source};
    ports[s.id]={id:s.id,node:s.terminalId,key:String(s.pole),displayTag:s.id,conductor:'L1',side:'bottom',...s.target};
    const circuit=mod?.channels?.[channel]||null;
    const phase=design.circuits?.find(c=>c.id===circuit)?.phase||'L1';
    const replaced=wires.find(w=>w.id===s.replacedWireId)||sourceNet?.wires.find(w=>w.id===s.replacedWireId);
    if(replaced) {const index=wires.findIndex(w=>w.id===replaced.id);if(index>=0) wires.splice(index,1);}
    wires.push({id:`terminal:${physicalOutput}>${s.id}`,from:physicalOutput,to:s.id,assignedOutput:s.output,conductor:phase,class:'power',lengthKind:'internal',section:s.section==null||s.section===''?null:Number(s.section),material:'Cu',scope:'模块通道 → 接线端子',connected:replaced?.connected!==false,protect:replaced?.protect,wireNo:s.wireNo||'',circuit,moduleId,terminalId:s.terminalId,terminalConnection:true,loadName:s.loadName||s.fieldName});
  }
  for(const row of terminalRows(design,resolve)) if(row.output&&!segments.some(s=>s.id===`${row.terminalId}:${row.pole}`)) {
    wiringIssues.push({code:'TERMINAL_CONNECTION_UNRESOLVED',level:'error',message:`${row.terminalId}:${row.pole} 的输出 ${row.output} 无法定位，请检查模块/通道或安装溢出`});
  }
  const uniqueIssues=[...new Map(wiringIssues.map(i=>[JSON.stringify([i.code,i.message||i.text,i.moduleId,i.circuit]),i])).values()];
  return {...net,assembly:assembly||net?.assembly,ports,wires,wiringIssues:uniqueIssues,delivery:true,deliverySource:sourceNet};
}
