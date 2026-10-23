const TOPICS:Record<string,RegExp>={'社保缴费':/缴费|缴存|基数|费率/,'住房公积金':/公积金/,'养老保险':/养老|退休/,'医疗保险':/医疗|医保/,'灵活就业':/灵活就业/,'生育保险':/生育/,'失业保险':/失业/,'工伤保险':/工伤/};
const decode=(s:string)=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();
type Item={title:string;url:string;description:string;date?:string};
async function fetchText(url:string){const response=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('upstream');return response.text()}
async function officialShanghai(topic:string):Promise<Item[]>{
 const indexes=['https://rsj.sh.gov.cn/tshbx_17729/index.html','https://rsj.sh.gov.cn/tgsgg_17341/index.html','https://ybj.sh.gov.cn/gfxwj/index.html'];
 const results=await Promise.allSettled(indexes.map(async index=>{
  const html=await fetchText(index);return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(m=>{
   const title=decode(m[2]);if(!TOPICS[topic].test(title)||title.length<10)return [];
   try{const url=new URL(m[1],index);const dateMatch=/\/(20\d{6})\//.exec(url.pathname);if(!dateMatch||url.protocol!=='https:'||!/(^|\.)sh\.gov\.cn$/.test(url.hostname))return [];
    const d=dateMatch[1],date=`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
    return [{title,url:url.href,date,description:`实时读取主管部门公开目录。页面路径日期：${date}；此日期不等于政策生效日期，请打开原文核对适用期、修改及废止情况。`}];
   }catch{return []}
  });
 }));
 return results.flatMap(r=>r.status==='fulfilled'?r.value:[]);
}
async function searchRss(city:string,topic:string):Promise<Item[]>{
 const query=`${city} ${new Date().getFullYear()} ${topic} 最新政策 site:gov.cn`;
 const xml=await fetchText(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);
 if(!xml.includes('<rss'))throw new Error('format');
 return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(match=>{
  const read=(tag:string)=>decode(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(match[1])?.[1]??'');
  const title=read('title'),url=read('link'),description=read('description').slice(0,260);
  try{const parsed=new URL(url);if(parsed.protocol!=='https:'||!/(^|\.)gov\.cn$/.test(parsed.hostname)||!TOPICS[topic].test(title+' '+description)||!(title+description).includes(city.replace(/市$/,'')))return [];return [{title,url,description}]}catch{return []}
 });
}
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length')||0)>2048)return Response.json({error:'请求过长'},{status:413});
  const data=await request.json() as {city?:unknown;topic?:unknown};const city=String(data.city??'').trim();const topic=String(data.topic??'');
  if(!/^[\p{Script=Han}a-zA-Z\s·-]{1,20}$/u.test(city)||!Object.hasOwn(TOPICS,topic))return Response.json({error:'请输入有效城市与政策主题'},{status:400});
  const local=city.replace(/市$/,'')==='上海';
  const settled=await Promise.allSettled([searchRss(city,topic),...(local?[officialShanghai(topic)]:[])]);
  const results=settled.flatMap(r=>r.status==='fulfilled'?r.value:[]);
  const items=[...new Map(results.map(r=>[r.url,r])).values()].sort((a,b)=>(b.date??'').localeCompare(a.date??'')).slice(0,10);
  if(!settled.some(s=>s.status==='fulfilled'))throw new Error('unavailable');
  return Response.json({items,checkedAt:new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date())},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'实时搜索服务暂不可用，请打开官方域名搜索。'},{status:503})}
}
