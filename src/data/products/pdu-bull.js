import {makeSmartProduct} from './_smart-factory.js';
const official='https://www.gongniu.cn/show-233-391-1.html';
/** 未核实尺寸明确作为可编辑建模初值，不宣称为厂家机械图。 */
export const BULL_PDU_PRODUCTS=[4,8].map(count=>({
  ...makeSmartProduct({id:`bull-gne-10${count}0`,sku:`GNE-10${count}0`,name:`${count}位PDU`,brand:'公牛',kind:'pdu',zone:'power',channels:0,powerInput:'cord-ac',
    width:count===8?490:300,height:44,depth:44,modules:Math.ceil((count===8?490:300)/18),color:'#35434a',
    amps:count===8?10:null,source:{file:count===8?'公牛官网 GNE-1080 基础款PDU':'参考公牛GNE系列外观；GNE-1040具体机械尺寸待核',url:official,pages:'产品外观与参数'},
    availability:count===8?'全长490mm与8位10A已核实；截面尺寸待核':'4位参考模型，机械尺寸及铭牌额定待核',
    note:count===8?'官网确认全长490mm、8位10A五孔、总额定10A/250V/2500W；截面44×44mm为建模初值，需实测后修改。支持横/竖安装；插位备注不等同已完成电气接线。':'参照GNE-1040四位五孔外观，300×44×44mm仅为可编辑的建模初值，非厂家确认尺寸；请按实物修订尺寸及核对额定。插位备注不等同已完成电气接线。'}),
  outletCount:count,pduPhysicalLength:count===8?490:300,pduPhysicalHeight:44,pduPhysicalDepth:44,
  dimensionsVerified:false,lengthVerified:count===8,ratedVoltage:count===8?250:null,maxPowerW:count===8?2500:null,
  mounting:'bracket',searchAliases:`PDU 插排 插座 GNE-10${count} GNE10${count} GNE-10${count}0`,
}));
