import {esc} from './_util.js';

/** Browser-measured pagination: repeat headings and table headers; never shrink text to fit. */
export function paginateDocumentPages(pages, metadata = {}) {
  if(typeof document==='undefined')return pages;
  const host=document.createElement('div');
  host.className='doc-pagination-measure';host.setAttribute('aria-hidden','true');
  host.style.cssText='position:absolute;left:-20000px;top:0;visibility:hidden;pointer-events:none;width:210mm;zoom:1';
  document.body.append(host);
  const output=[];
  try {
    for(const page of pages) {
      if(page.svg){
        output.push({...page,pageSize:'A4',html:`<article class="doc-page doc-page--paged doc-svg"><div class="doc-body">${page.svg}</div><footer class="doc-version"><span>${esc(metadata.name||'配电方案')} · ${esc(metadata.revision||'')}</span><span class="doc-page-number">第 000 / 000 页</span></footer></article>`});continue;
      }
      if(page.pageSize==='A4-labels'){output.push({...page});continue;}
      const source=document.createElement('div');source.innerHTML=page.html||'';
      const articles=[...source.querySelectorAll(':scope > article.doc-page')];
      if(!articles.length){output.push({...page});continue;}
      let part=0;
      for(const article of articles) {
        const body=article.querySelector('.doc-body');
        if(!body){output.push({...page});continue;}
        const units=contentUnits(body);
        let target,bodyTarget,paths,count=0;
        const start=()=>{
          host.replaceChildren();
          const sheet=document.createElement('section');sheet.className='v5-doc-sheet';sheet.dataset.size='A4';
          target=article.cloneNode(false);target.classList.add('doc-page--paged');
          for(const child of article.children)if(!child.classList.contains('doc-body')&&!child.classList.contains('doc-version'))target.append(child.cloneNode(true));
          bodyTarget=body.cloneNode(false);target.append(bodyTarget);
          const footer=document.createElement('footer');footer.className='doc-version';
          footer.innerHTML=`<span>${esc(metadata.name||'配电方案')} · ${esc(metadata.revision||'')}</span><span class="doc-page-number">第 000 / 000 页</span>`;
          target.append(footer);sheet.append(target);host.append(sheet);paths=new Map();count=0;
        };
        const finish=()=>{
          part++;
          output.push({...page,id:part===1?page.id:`${page.id}--${part}`,title:part===1?page.title:`${page.title} · 续 ${part}`,pageSize:'A4',html:target.outerHTML});
        };
        start();
        // jsdom has no layout; still separates multiple source articles deterministically.
        const measurable=bodyTarget.clientHeight>0;
        for(const unit of units) {
          let inserted=appendUnit(unit,bodyTarget,paths);
          if(measurable&&bodyTarget.scrollHeight>bodyTarget.clientHeight+1&&count>0) {
            inserted.remove();pruneEmptyContainers(bodyTarget);finish();start();
            inserted=appendUnit(unit,bodyTarget,paths);
          }
          if(measurable&&bodyTarget.scrollHeight>bodyTarget.clientHeight+1) {
            target.dataset.layoutOverflow='true';
          }
          count++;
        }
        finish();
      }
    }
  } finally {host.remove();}
  return output.map((page,index)=>{
    if(!page.html||page.pageSize==='A4-labels')return page;
    return {...page,html:page.html.replace(/第 000 \/ 000 页/g,`第 ${index+1} / ${output.length} 页`)};
  });
}

const CONTAINERS='section, .cover, .cover-meta, .face-grid, .cable-grid, .tag-list, .term-strip, .module-faces';

function leadingHeadings(node) {
  const headings=[];
  for(const child of node.childNodes) {
    if(child.nodeType!==1&&!child.textContent.trim())continue;
    if(child.nodeType===1&&child.matches('h2,h3'))headings.push(child);
    else break;
  }
  return headings;
}

function contentUnits(root) {
  const units=[];
  const walk=(node,path=[])=>{
    if(node.nodeType!==1){if(node.textContent.trim())units.push({node,path});return;}
    if(node.matches('table')) {
      const rows=[...node.querySelectorAll(':scope > tbody > tr')];
      if(!rows.length){units.push({node,path});return;}
      for(const row of rows)units.push({node:row,path:[...path,node]});
    } else if(node.matches(CONTAINERS)) {
      const headings=leadingHeadings(node);
      const children=[...node.childNodes].filter(child=>!headings.includes(child));
      if(!children.length){units.push({node,path});return;}
      children.forEach(child=>walk(child,[...path,node]));
    } else if(node.matches('pre')&&node.textContent.split('\n').length>22) {
      const lines=node.textContent.split('\n');
      for(let i=0;i<lines.length;i+=22){const part=node.cloneNode(false);part.textContent=lines.slice(i,i+22).join('\n');units.push({node:part,path});}
    } else units.push({node,path});
  };
  [...root.childNodes].forEach(node=>walk(node));return units;
}

function appendUnit(unit,root,paths) {
  let parent=root;
  for(const source of unit.path) {
    let container=paths.get(source);
    if(!container) {
      container=source.cloneNode(false);parent.append(container);
      if(source.matches('table')) {
        for(const child of source.children)if(child.tagName!=='TBODY')container.append(child.cloneNode(true));
        container.append(document.createElement('tbody'));
      } else for(const child of leadingHeadings(source))container.append(child.cloneNode(true));
      paths.set(source,container);
    }
    parent=container.matches('table')?container.querySelector('tbody'):container;
  }
  const copy=unit.node.cloneNode(true);parent.append(copy);return copy;
}

function pruneEmptyContainers(root) {
  for(const table of root.querySelectorAll('table'))if(!table.querySelector('tbody > tr'))table.remove();
  for(const node of [...root.querySelectorAll(CONTAINERS)].reverse()) {
    if(![...node.childNodes].some(child=>child.nodeType===1?!child.matches('h2,h3'):child.textContent.trim()))node.remove();
  }
}
