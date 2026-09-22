import {it,expect} from 'vitest';
import {terminalLabelLayout} from '../../src/view/terminal-label-layout.js';

it.each([1,8,40,48,100,300])('keeps %i connection labels within the cabinet, without overlapping',count=>{
  const box={width:720,height:1190};
  const segments=Array.from({length:count},()=>({field:{y:470}}));
  const layout=terminalLabelLayout(segments,box);
  const all=[...layout.labels,...layout.overflow?[layout.overflow]:[]];
  expect(layout.labels.length+(layout.overflow?.count||0)).toBe(count);
  for(const a of all){
    expect(Math.abs(a.x)+a.width/2).toBeLessThan(box.width/2);
    expect(a.y+a.height/2).toBeLessThan(box.height/2);
    expect(a.y-a.height/2).toBeGreaterThan(segments[0].field.y);
    for(const b of all.filter(b=>b!==a)) expect(Math.abs(a.x-b.x)>=(a.width+b.width)/2 || Math.abs(a.y-b.y)>=(a.height+b.height)/2).toBe(true);
  }
});
it('uses an in-cabinet summary when no header clearance remains',()=>{
  const layout=terminalLabelLayout([{field:{y:150}}],{width:200,height:300});
  expect(layout.labels).toEqual([]);
  expect(layout.overflow.count).toBe(1);
  expect(layout.overflow.y+layout.overflow.height/2).toBeLessThan(150);
});
