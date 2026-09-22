import {it,expect,vi,afterEach} from 'vitest';
import {Mesh,BoxGeometry,MeshStandardMaterial,Vector3,PlaneGeometry,Box3} from 'three';
import {buildSmartDevice} from '../../src/view/smart-device3d.js';
import {NETWORK_SWITCH_PRODUCTS} from '../../src/data/products/network-switches.js';
import {networkSwitchProduct} from '../../src/core/network-switch-settings.js';
import {moduleFaceScene} from '../../src/view/module-face.js';
vi.mock('../../src/view/module-face.js',async original=>({...await original(),paintModuleFace:()=>{}}));
afterEach(()=>vi.unstubAllGlobals());
function kit(){
  vi.stubGlobal('document',{createElement:()=>({getContext:()=>({})})});
  return {textures:new Map(),own:x=>x,batch(){},screw(){},text(){},
    cube(group,w,h,d,x,y,z){const mesh=new Mesh(new BoxGeometry(w,h,d),new MeshStandardMaterial());mesh.position.set(x,y,z);group.add(mesh);return mesh;},
    decal(group,tex,w,h,x,y,z){const mesh=new Mesh(new PlaneGeometry(w,h),new MeshStandardMaterial());mesh.position.set(x,y,z);group.add(mesh);},
  };
}
it.each(['front','up','down'])('真实端口法线%s且机身备注面向可读方向',orientation=>{
  const p=networkSwitchProduct(NETWORK_SWITCH_PRODUCTS[2],{switchOrientation:orientation,switchPortLabels:{1:'客厅AP'}});
  const {group}=buildSmartDevice(kit(),p);
  group.updateMatrixWorld(true);
  const frames=[];group.traverse(mesh=>{if(mesh.userData.networkPort)frames.push(mesh);});
  expect(frames).toHaveLength(16);
  const normal=new Vector3(0,0,1).transformDirection(frames[0].matrixWorld);
  expect(normal.distanceTo(new Vector3(...(orientation==='front'?[0,0,1]:orientation==='up'?[0,1,0]:[0,-1,0])))).toBeLessThan(1e-6);
  const plate=group.children.find(n=>n.userData.networkPortLabels);
  expect(plate).toBeTruthy();
  const labelNormal=new Vector3(0,0,1).transformDirection(plate.matrixWorld);
  expect(labelNormal.distanceTo(new Vector3(...(orientation==='front'?[0,1,0]:[0,0,1])))).toBeLessThan(1e-6);
  const tray=group.children.find(n=>n.userData.mountingTray);
  expect(new Box3().setFromObject(tray).max.y).toBeLessThan(-p.height/2);
  group.traverse(mesh=>{mesh.geometry?.dispose();mesh.material?.dispose();});
});
it('24字端口备注分三行完整绘制，不被省略号截断',()=>{
  const p=NETWORK_SWITCH_PRODUCTS[2],label='端口信息'.repeat(6);
  const scene=moduleFaceScene({...p,faceRole:'network-port-labels',switchPortLabels:{1:label}},p.width-10,p.depth-12);
  expect(scene.shapes.filter(s=>s.tag==='text'&&s.text==='端口信息端口信息')).toHaveLength(3);
});

it.each(['192.168.1.123','客厅交换机接入点AP01','端口信息'.repeat(6)])('多行备注 %s 使用统一字号且完整容纳',label=>{
  const p=NETWORK_SWITCH_PRODUCTS[1];
  const scene=moduleFaceScene({...p,faceRole:'network-port-labels',switchPortLabels:{1:label}},p.width-10,p.depth-12);
  const lines=scene.shapes.filter(s=>s.tag==='text'&&s.fill==='#233b31'&&s.x===scene.w/16);
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.map(s=>s.text).join('')).toBe(label);
  expect(new Set(lines.map(s=>s['font-size'])).size).toBe(1);
  for(const line of lines){
    const width=[...line.text].reduce((sum,c)=>sum+(c.charCodeAt(0)>255?1:.64)*line['font-size'],0);
    expect(width).toBeLessThanOrEqual(scene.w/8-10+1e-6);
  }
});

it.each(['front','up','down'])('只有备注名称时也在%s机身显示独立铭牌',orientation=>{
  const p=networkSwitchProduct(NETWORK_SWITCH_PRODUCTS[3],{switchOrientation:orientation,displayName:'一楼网络中心'});
  const {group}=buildSmartDevice(kit(),p);
  expect(group.children.some(n=>n.userData.networkDisplayName)).toBe(true);
  expect(group.children.some(n=>n.userData.networkPortLabels)).toBe(false);
  const scene=moduleFaceScene({...p,faceRole:'module-note'},p.width-10,10);
  expect(scene.shapes.some(s=>s.text==='一楼网络中心')).toBe(true);
  group.traverse(mesh=>{mesh.geometry?.dispose();mesh.material?.dispose();});
});
