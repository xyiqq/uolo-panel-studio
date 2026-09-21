import {terminalRows, outputOptions, saveTerminalRows, terminalCsv} from '../core/terminal-connections.js';
import {terminalConnectionSvg, esc} from '../view/terminal-connections.js';
import '../styles/terminal-connections.css';

export function renderTerminalConnections({root, design, resolve, commit, download}) {
  const rows = terminalRows(design,resolve), outputs = outputOptions(design,resolve);
  const options = (items,current) => items.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(t)}</option>`).join('');
  root.innerHTML = `<section class="terminal-editor"><div class="pane-head"><h2>端子连接</h2><div class="tools"><button class="btn" id="terminal-svg">下载 SVG</button><button class="btn" id="terminal-csv">接线 CSV</button><button class="btn primary" id="terminal-save">保存接线</button></div></div>
    <p class="terminal-status" role="status"></p>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>端子节号</th><th>上端设备</th><th>类型</th><th>下端输出通道</th><th>线号</th><th>线径 mm²</th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-connection="${i}"><td>${esc(r.terminalId)}:${r.pole}</td>
      <td><input aria-label="${esc(r.terminalId)}:${r.pole} 上端设备" data-field="loadName" maxlength="80" value="${esc(r.loadName)}"></td>
      <td><select data-field="loadType" aria-label="设备类型">${options([['light','灯具'],['motor','电机'],['other','其他']],r.loadType)}</select></td>
      <td><select data-field="output" aria-label="${esc(r.terminalId)}:${r.pole} 下端通道" ${r.color==='blue'?'disabled':''}>${options([['','未连接'],...outputs.map(o=>[o.value,o.label])],r.output)}</select></td>
      <td><input data-field="wireNo" aria-label="线号" maxlength="40" value="${esc(r.wireNo)}"></td>
      <td><select data-field="section" aria-label="线径">${options([['','待核'],...[.5,.75,1,1.5,2.5,4,6].map(n=>[n,n])],r.section ?? '')}</select></td></tr>`).join('')}</tbody></table></div>
      <div class="terminal-preview">${terminalConnectionSvg(rows)}</div>` : '<p class="empty">尚未安装 PT2.5 端子，请先从产品库装入。</p>'}
    <p class="data-note">功能接线图：上端为设备侧，下端为柜内侧。N / PE、模块馈电及电机正反转互锁需单独配置与核验。</p></section>`;
  const read = () => rows.map((r,i)=>({...r,...Object.fromEntries([...root.querySelectorAll(`[data-connection="${i}"] [data-field]`)].map(el=>[el.dataset.field,el.value]))}));
  const status = root.querySelector('.terminal-status');
  root.querySelector('#terminal-save').disabled = !rows.length;
  root.querySelector('#terminal-save').onclick = () => {
    try {
      const next = read();
      saveTerminalRows(structuredClone(design),next,resolve);
      commit(d=>saveTerminalRows(d,next,resolve),true);
      root.querySelector('.terminal-status').textContent='接线已保存';
    } catch(e) { status.textContent=e.message; status.classList.add('error'); }
  };
  root.querySelector('#terminal-csv').onclick=()=>download('端子连接.csv',terminalCsv(read()),'text/csv;charset=utf-8');
  root.querySelector('#terminal-svg').onclick=()=>download('端子连接.svg',terminalConnectionSvg(read()),'image/svg+xml');
  root.querySelector('table')?.addEventListener('change',()=>{
    root.querySelector('.terminal-preview').innerHTML=terminalConnectionSvg(read());
    status.textContent='有未保存的接线修改';
  });
}
