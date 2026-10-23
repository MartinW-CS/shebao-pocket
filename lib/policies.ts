export type Source={title:string;url:string;effective:string};
export const policyRows=[
 ['养老保险','16%','8%','2019-05-01起','https://rsj.sh.gov.cn/tshbx_17729/20230911/t0035_1418257.html','单位部分进入统筹；个人部分记入个人账户'],
 ['医疗保险（含生育）','9%','2%','2026-03-01—2027-02-28','https://shanghai.chinatax.gov.cn/zcfw/zcfgk/sbf/202603/t479836.html','单位8.5%基本医保（含生育）+0.5%地方附加'],
 ['生育保险','并入上述医疗缴费','0','同上','https://shanghai.chinatax.gov.cn/zcfw/zcfgk/sbf/202603/t479836.html','不重复加一笔单位生育费'],
 ['失业保险','最新延续比例待核实','0.5%','个人比例：2026-09-12官方答复','https://www.shanghai.gov.cn/nw17239/20260913/37398bbb63ad4fffa64e0b9deb0f6afc.html','旧单位0.5%降费条款仅明确至2025年，未据此续填2026'],
 ['工伤保险','0.2%—1.9%（八类基准）','0','2026-01-01—2030-12-31','https://rsj.sh.gov.cn/tshbx_17729/20260121/t0035_1438097.html','八档0.2/0.4/0.7/0.9/1.1/1.3/1.6/1.9%；另有浮动'],
 ['普通住房公积金','5%—7%','5%—7%','2026缴存年度：2026-07—2027-06','https://www.shzfgjj.cn/html/jcjsllb/40204.html','单位与个人相同比例；5%、6%、7%档'],
 ['补充住房公积金','1%—5%（自愿）','1%—5%（自愿）','2026缴存年度','https://www.shzfgjj.cn/html/jcjsllb/40204.html','不等于所有人都应缴；两方相同比例'],
 ['社保缴费基数','下限7,546元','上限37,731元','2026-07-01起','https://rsj.sh.gov.cn/tgsgg_17341/20260818/t0035_1443203.html','全口径平均工资12,577元/月；缴费基数并非一律当月工资'],
 ['公积金缴存基数','下限2,740元','上限37,731元','2026-07—2027-06','https://www.shzfgjj.cn/html/jcjsllb/40204.html','按官方年度表及缴存办法核对；2026通知正文未完整取得'],
];
export const flexSources:Source[]=[
 {title:'上海灵活就业养老缴费与个人账户',url:'https://rsj.sh.gov.cn/tmsztc_17502/20240918/t0035_1427792.html',effective:'2024-03-01起：养老20%，8%记个人账户'},
 {title:'灵活就业医保办法',url:'https://ybj.sh.gov.cn/gfxwj/20250905/6173c838284f43c3b4d8c8d4513364ed.html',effective:'2025-09-10—2030-09-09；医保10%、账户2%、等待期6个月'},
];
export const taxSource='https://shanghai.chinatax.gov.cn/zcfw/zcjd/201812/t443220.html';
export const deductionSource='https://shanghai.chinatax.gov.cn/tax/zcfw/zcfgk/grsds/202309/t468511.html';
export const taxBands=[[36000,3,0],[144000,10,2520],[300000,20,16920],[420000,25,31920],[660000,30,52920],[960000,35,85920],[Infinity,45,181920]];
export function cumulativeTax(income:number,deduction:number,paid:number){const taxable=Math.max(0,income-deduction);const row=taxBands.find(r=>taxable<=r[0])!;return {taxable,rate:row[1],tax:Math.max(0,taxable*row[1]/100-row[2]-paid)};}
