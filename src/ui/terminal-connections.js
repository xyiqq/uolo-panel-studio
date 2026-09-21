import {terminalRows, outputOptions, saveTerminalRows, terminalCsv, sequentialTerminalRows, sequentialWireNumbers} from '../core/terminal-connections.js';
import {terminalConnectionSvg, esc} from '../view/terminal-connections.js';
import '../styles/terminal-connections.css';

export function renderTerminalConnections({root, design, resolve, commit, download, terminalId=null}) {
  const rows = terminalRows(design,resolve), outputs = outputOptions(design,resolve);
  const options = (items,current) => items.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(t)}</option>`).join('');
  root.innerHTML = `<section class="terminal-editor"><div class="pane-head"><h2>端子连接</h2><div class="tools"><button class="btn" id="terminal-svg">下载 SVG</button><button class="btn" id="terminal-csv">接线 CSV</button><button class="btn primary" id="terminal-save">保存接线</button></div></div>
    <p class="terminal-status" role="status"></p>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>端子节号</th><th>上端设备</th><th>类型</th><th>下端输出通道</th><th>线号</th><th>线径 mm²</th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-connection="${i}"><td>${esc(r.terminalId)}:${r.pole}</td>
      <td><input aria-label="${esc(r.terminalId)}:${r.pole} 上端设备" data-field="loadName" maxlength="80" value="${esc(r.loadName)}"></td>
      <td><select data-field="loadType" aria-label="设备类型">${options([['light','灯具'],['motor','电机'],['other','其他']],r.loadType)}</select></td>
      <td><select data-field="output" aria-label="${esc(r.terminalId)}:${r.pole} 下端通道" ${r.color==='blue'?'disabled':''}>${options([['','未连接'],...outputs.map(o=>[o.value,o.label])],r.output)}</select></td>
      <td><input data-field="wireNo" aria-label="线号" placeholder="如 L01、WL-001" title="保留前缀，末尾数字依次递增；在本组第一节输入后可批量填写" maxlength="40" value="${esc(r.wireNo)}"></td>
      <td><select data-field="section" aria-label="线径">${options([['','待核'],...[.5,.75,1,1.5,2.5,4,6].map(n=>[n,n])],r.section ?? '')}</select></td></tr>`).join('')}</tbody></table></div>
      <div class="terminal-preview">${terminalConnectionSvg(rows.filter(r=>!terminalId||r.terminalId===terminalId))}</div>` : '<p class="empty">尚未安装 PT2.5 端子，请先从产品库装入。</p>'}
    <p class="data-note">线号规则：前缀不变，末尾数字递增并保留补零，例如 L01 → L02 → L03。第一节填写后可批量填充本组空白线号，跳过已有线号。新端子线径默认 1.5 mm²，修改第一节可统一本组。<br>功能接线图：上端为设备侧，下端为柜内侧。N / PE、模块馈电及电机正反转互锁需单独配置与核验。</p></section>`;
  const read = () => rows.map((r,i)=>({...r,...Object.fromEntries([...root.querySelectorAll(`[data-connection="${i}"] [data-field]`)].map(el=>[el.dataset.field,el.value]))}));
  const status = root.querySelector('.terminal-status');
  let sequenceTerminal = null;
  const refreshPreview = () => {
    root.querySelector('.terminal-preview').innerHTML=terminalConnectionSvg(read().filter(r=>!terminalId||r.terminalId===terminalId));
    status.classList.remove('error');
    status.textContent='有未保存的接线修改';
  };
  const refreshOptions = () => {
    const draft=read();
    root.querySelectorAll('[data-connection]').forEach((tr,i)=>{
      const current=draft[i].output;
      const used=new Set(draft.filter((_,j)=>j!==i).map(r=>r.output).filter(Boolean));
      tr.querySelector('[data-field="output"]').innerHTML=options([['','未连接'],...outputs.filter(o=>o.value===current||!used.has(o.value)).map(o=>[o.value,o.label])],current);
      tr.hidden=!!terminalId && rows[i].terminalId!==terminalId;
    });
  };
  const showSequencePrompt = () => {
    root.querySelector('[data-sequence-prompt]')?.remove();
    if (!sequenceTerminal) return;
    const plan = sequentialTerminalRows(read(),outputs,sequenceTerminal);
    if (!plan.count) return;
    const index = rows.findIndex(r=>r.terminalId===sequenceTerminal && r.pole===1);
    const cell = root.querySelector(`[data-connection="${index}"] [data-field="output"]`).parentElement;
    const prompt = document.createElement('div');
    prompt.dataset.sequencePrompt = '';
    prompt.setAttribute('role','status');
    prompt.innerHTML = `<p>是否按模块、通道顺序连接本组后续 ${plan.count} 节端子？跳过已占用通道，保留已有接线；通道用尽时停止。</p><div class="tools"><button type="button" class="btn primary" data-sequence-apply>按顺序连接</button><button type="button" class="btn" data-sequence-dismiss>逐个选择</button></div>`;
    cell.append(prompt);
    prompt.querySelector('[data-sequence-apply]').onclick = () => {
      const result = sequentialTerminalRows(read(),outputs,sequenceTerminal);
      result.rows.forEach((r,i)=>{root.querySelector(`[data-connection="${i}"] [data-field="output"]`).value=r.output;});
      sequenceTerminal=null;
      prompt.remove();
      refreshOptions();
      refreshPreview();
      status.textContent=`已顺序连接 ${result.count} 节端子，请点击“保存接线”保存`;
    };
    prompt.querySelector('[data-sequence-dismiss]').onclick = () => {sequenceTerminal=null;prompt.remove();};
  };
  const showBatchPrompt = (row,field) => {
    root.querySelector(`[data-batch-prompt="${field}"]`)?.remove();
    if(row?.pole!==1) return;
    const draft=read(),first=draft.find(r=>r.terminalId===row.terminalId&&r.pole===1);
    const targets=draft.filter(r=>r.terminalId===row.terminalId&&r.pole>1);
    const plan=field==='wireNo'?sequentialWireNumbers(draft,row.terminalId):null;
    if(field==='wireNo'&&!plan.count) {
      if(first.wireNo&&!/\d$/.test(first.wireNo.trim())) status.textContent='线号末尾请填写数字，例如 L01 或 WL-001，才能按顺序填写后续端子';
      return;
    }
    if(!targets.length||(field==='section'&&!first.section)) return;
    const index=rows.findIndex(r=>r.terminalId===row.terminalId&&r.pole===1);
    const prompt=document.createElement('div');prompt.dataset.batchPrompt=field;prompt.setAttribute('role','status');
    const preview=plan?.rows.find(r=>r.terminalId===row.terminalId&&r.pole>1&&r.wireNo!==draft.find(d=>d.terminalId===r.terminalId&&d.pole===r.pole).wireNo)?.wireNo;
    prompt.innerHTML=`<p>${field==='wireNo'?`从 ${esc(preview)} 起顺序填写本组 ${plan.count} 个空白线号？保留已有线号。`:`将本组其余 ${targets.length} 节的线径全部统一为 ${esc(first.section)} mm²？将替换已有线径。`}</p><div class="tools"><button type="button" class="btn primary" data-batch-apply>${field==='wireNo'?'顺序填写':'统一线径'}</button><button type="button" class="btn" data-batch-dismiss>逐个填写</button></div>`;
    root.querySelector(`[data-connection="${index}"] [data-field="${field}"]`).parentElement.append(prompt);
    prompt.querySelector('[data-batch-dismiss]').onclick=()=>prompt.remove();
    prompt.querySelector('[data-batch-apply]').onclick=()=>{
      const current=read(),head=current.find(r=>r.terminalId===row.terminalId&&r.pole===1);
      const result=field==='wireNo'?sequentialWireNumbers(current,row.terminalId).rows:current.map(r=>r.terminalId===row.terminalId?{...r,section:head.section}:r);
      result.forEach((r,i)=>{root.querySelector(`[data-connection="${i}"] [data-field="${field}"]`).value=r[field]??'';});
      prompt.remove();refreshPreview();
    };
  };
  refreshOptions();
  root.querySelector('#terminal-save').disabled = !rows.length;
  root.querySelector('#terminal-save').onclick = () => {
    try {
      const next = read();
      saveTerminalRows(structuredClone(design),next,resolve);
      commit(d=>saveTerminalRows(d,next,resolve),true);
      sequenceTerminal=null;
      root.querySelector('[data-sequence-prompt]')?.remove();
      root.querySelectorAll('[data-batch-prompt]').forEach(el=>el.remove());
      status.classList.remove('error');
      root.querySelector('.terminal-status').textContent='接线已保存';
    } catch(e) { status.textContent=e.message; status.classList.add('error'); }
  };
  root.querySelector('#terminal-csv').onclick=()=>download('端子连接.csv',terminalCsv(read()),'text/csv;charset=utf-8');
  root.querySelector('#terminal-svg').onclick=()=>download('端子连接.svg',terminalConnectionSvg(read()),'image/svg+xml');
  root.querySelector('table')?.addEventListener('change',event=>{
    const row = rows[Number(event.target.closest('[data-connection]')?.dataset.connection)];
    if (event.target.dataset.field==='output' && row?.pole===1) sequenceTerminal=event.target.value ? row.terminalId : null;
    refreshOptions();
    refreshPreview();
    showSequencePrompt();
    if(['wireNo','section'].includes(event.target.dataset.field)) showBatchPrompt(row,event.target.dataset.field);
  });
}
