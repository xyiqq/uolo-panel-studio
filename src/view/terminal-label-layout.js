// Fit labels into the cabinet header, above the highest terminal, instead of
// growing an unbounded stack upwards for every additional connection.
export function terminalLabelLayout(segments, box) {
  if (!segments.length) return {labels:[], overflow:null};
  const width = Math.max(1, box.width - 64);
  const top = box.height / 2 - 42;
  const bottom = Math.max(...segments.map(s=>s.field.y)) + 16;
  const rowPitch = 13, height = 9;
  const rows = Math.max(0, Math.floor((top-bottom)/rowPitch));
  const maxColumns = Math.max(1, Math.floor(width/56));
  if (!rows) return {labels:[],overflow:{count:segments.length,x:0,y:top-height/2,width:Math.min(180,width),height}};
  const columns = Math.min(maxColumns,Math.max(Math.min(4,maxColumns),Math.ceil(segments.length/rows)));
  const capacity = rows*columns;
  const count = Math.min(segments.length,capacity-(segments.length>capacity?1:0));
  const cellWidth = width/columns;
  const at = i => ({x:-width/2+(i%columns+.5)*cellWidth,
    y:top-height/2-Math.floor(i/columns)*rowPitch,width:Math.min(76,cellWidth-6),height});
  return {labels:Array.from({length:count},(_,i)=>at(i)),
    overflow:count<segments.length?{...at(count),count:segments.length-count}:null};
}
