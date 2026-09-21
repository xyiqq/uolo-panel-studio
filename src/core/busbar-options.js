export function applyBusbarOptions(net,design){
  const removed=new Set();
  if(design.includeNeutralBar===false) removed.add('N');
  if(design.includeEarthBar===false) removed.add('PE');
  if(!removed.size) return net;
  const ports=Object.fromEntries(Object.entries(net.ports).filter(([,p])=>!removed.has(p.node)));
  return {...net,nodes:net.nodes.filter(n=>!removed.has(n.id)),ports,
    wires:net.wires.filter(w=>ports[w.from] && ports[w.to]),
    internal:net.internal.filter(w=>ports[w.a] && ports[w.b]),
  };
}
