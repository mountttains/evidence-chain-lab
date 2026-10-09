(function(root){
"use strict";
const names={operating:"营业利润",net:"GAAP 净利润",gross:"毛利润"};
const pct=(a,b)=>(a/b-1)*100;
const fmt=n=>(n>=0?"+":"")+n.toFixed(2)+"%";
function validateData(d){
 if(!d||d.version!=="apple-fy2024-v1"||!Array.isArray(d.sources)||d.taxAdjustment!==10246)throw Error("数据结构或版本不匹配");
 for(const p of ["annual","quarter"])for(const y of ["current","prior"]){
  const v=d[p]?.[y];if(!v)throw Error("缺少比较期间");
  for(const k of ["revenue","productRevenue","serviceRevenue","productCost","serviceCost","gross","operating","net","tax"])if(!Number.isFinite(v[k])||v[k]<0)throw Error("非法财务数值");
  if(v.revenue!==v.productRevenue+v.serviceRevenue||v.gross!==v.revenue-v.productCost-v.serviceCost)throw Error("收入或毛利勾稽失败");
 }
 return d;
}
function checkThesis(t){
 if(t.trim().length<8)throw Error("请写出至少 8 个字的完整命题。");
 if(!/苹果|apple|AAPL/i.test(t))throw Error("当前数据只覆盖 Apple。请在命题中明确苹果 / Apple，其他公司需新增原始资料。");
 if(/茅台|腾讯|英伟达|特斯拉|微软|nvidia|tesla|microsoft|tencent/i.test(t))throw Error("当前不支持跨公司比较，请仅验证苹果财务命题。");
 if(!/利润|盈利|毛利|营收|收入|profit|revenue/i.test(t))throw Error("当前可验证盈利、收入和主营结构命题；估值、股价或产业链命题缺少对应数据。");
 if(/202[0-25-9]|203\d|2023年/.test(t))throw Error("当前仅验证 FY2024 相对 FY2023；请调整命题年份，不支持当前或未来财年结论。");
 if(/买入|卖出|荐股|目标价|保本|保证收益/.test(t))throw Error("不提供个性化买卖建议或收益保证。请改为可核验的财务研究问题。");
 if(!/改善|增长|提升|上升/.test(t)||/未改善|没有改善|并未|下降|恶化|回落|下滑/.test(t))throw Error("规则模板仅验证盈利改善命题；请写成可证伪的改善假设，下降方向将在反对证据中呈现。"); return t.trim();
}
function analyze(data,thesis,period="annual",metric="operating"){
 validateData(data);checkThesis(thesis);
 if(!data[period]||!names[metric])throw Error("不支持的比较口径");
 const {current:c,prior:p,label}=data[period];
 const chosen=pct(c[metric],p[metric]),op=pct(c.operating,p.operating),net=pct(c.net,p.net),rev=pct(c.revenue,p.revenue);
 const sg=c.serviceRevenue-c.serviceCost,sp=p.serviceRevenue-p.serviceCost;
 const share=(sg-sp)/(c.gross-p.gross)*100;
 const grossChange=(c.gross/c.revenue-p.gross/p.revenue)*100;
 const scope=period==="annual"?"全年":"第四季度";
 const positive=chosen>0;
 const evidence=[
 {id:"E1",kind:positive?"support":"against",title:scope+names[metric]+"同比 "+fmt(chosen),detail:c[metric].toLocaleString()+" vs "+p[metric].toLocaleString()+" 百万美元；历史财务改善"+(positive?"成立":"不成立")+"。",quote:names[metric]+" / 2024: "+c[metric]+"; 2023: "+p[metric]+" (USD millions)",source:"S1",page:1,reason:"计算：(本期 / 上期 − 1) × 100。支持或反对所选利润口径的历史改善，不自动证明持续性。"},
 {id:"E2",kind:"support",title:"服务业务贡献约 "+share.toFixed(1)+"% 的毛利增量",detail:"服务毛利增量 "+(sg-sp).toLocaleString()+" / 总毛利增量 "+(c.gross-p.gross).toLocaleString()+" 百万美元。",quote:"Services net sales: "+c.serviceRevenue+" / "+p.serviceRevenue+"; Services cost of sales: "+c.serviceCost+" / "+p.serviceCost+" (2024 / 2023, USD millions)",source:"S1",page:1,reason:"服务毛利 = 服务收入 − 服务成本。贡献比例是会计拆分，不足以识别定价、销量、汇率等因果机制。"},
 {id:"E3",kind:"against",title:"GAAP 净利润同比 "+fmt(net)+"，不能笼统称盈利全面改善",detail:"一次性所得税调整为 10,246 百万美元。须区分法定口径与调整后口径。",quote:data.quotes.tax+"\n"+data.quotes.boundary,source:"S1",page:4,reason:"第 4 页披露税项调节；净利润原值见第 1 页。净利润下降与营业利润增长可同时成立，不是数据错误。"},
 {id:"E4",kind:"support",title:"综合毛利率上升 "+grossChange.toFixed(2)+" 个百分点",detail:(c.gross/c.revenue*100).toFixed(2)+"% vs "+(p.gross/p.revenue*100).toFixed(2)+"%；总收入同比 "+fmt(rev)+"。",quote:"Total net sales: "+c.revenue+" / "+p.revenue+"; Gross margin: "+c.gross+" / "+p.gross+" (2024 / 2023, USD millions)",source:"S1",page:1,reason:"毛利率 = 毛利润 / 总收入。增长可支持主营层面改善，但不能单独证明竞争壁垒或增长持续。"},
 {id:"E5",kind:"unknown",title:"未来持续性：无法由本期材料验证",detail:"缺少后续可比期间、产品周期、定价和渠道去化材料。",quote:"没有足够原始材料。不能将缺失证据自动标记为支持。",source:null,page:null,reason:"需要后续财报和独立经营数据；只列出待验证条件，不推断未来。"},
 {id:"E6",kind:"unknown",title:"独立交叉验证：发行人之外的证据仍不足",detail:"本案例的财务报表与新闻稿同属 Apple 披露，并非两份独立验证。",quote:"当前证据集合未包含独立渠道调研、客户数据或第三方原始样本。",source:null,page:null,reason:"来源权威性与来源独立性是两回事；暂不赋予虚构的概率置信度。"}
 ];
 return {thesis,period,metric,label,chosen,op,net,share,grossChange,evidence,
 verdict:positive?"部分支持":"反对当前口径",
 headline:positive?"历史经营改善成立，持续性仍待验证":"净利润并未改善，需要修订命题",
 conclusion:label+"，"+names[metric]+"同比 "+fmt(chosen)+"。服务业务贡献约 "+share.toFixed(1)+"% 的毛利增量，支持主营层面改善；但 GAAP 净利润同比 "+fmt(net)+"，受到一次性税项影响。现有材料不足以验证未来持续性或作出买卖判断。",
 questions:[
 {text:"所选利润口径真的改善了吗？",answer:names[metric]+"同比 "+fmt(chosen),id:"E1",kind:positive?"support":"against"},
 {text:"主营业务结构对改善有多大贡献？",answer:"服务毛利占总毛利增量 "+share.toFixed(1)+"%；会计归因不等同因果证明",id:"E2",kind:"support"},
 {text:"一次性项目是否改变了结论？",answer:"税项解释营业利润与净利润方向相反",id:"E3",kind:"against"},
 {text:"毛利率是否有可计算的改善？",answer:"提高 "+grossChange.toFixed(2)+" 个百分点",id:"E4",kind:"support"},
 {text:"未来还能持续吗？",answer:"缺少后续期间和独立材料",id:"E5",kind:"unknown"},
 {text:"是否有独立信源交叉验证？",answer:"当前两个原始材料均由 Apple 发布",id:"E6",kind:"unknown"}]};
}
function answer(question,r){
 if(/买|卖|目标价|保本|收益保证/.test(question))return {text:"不提供个性化买卖建议、目标价或收益保证。可以继续核查利润、收入、税项和数据缺口。",ids:[]};
 if(/税|净利|下降|冲突/.test(question))return {text:"营业利润与净利润是不同口径。"+r.label+"净利润同比 "+fmt(r.net)+"；第 4 页披露一次性所得税调整 10,246 百万美元。不能以 Non-GAAP 指标替代 GAAP 结果。",ids:["E1","E3"]};
 if(/服务|主营|毛利|结构/.test(question))return {text:"服务业务毛利增量约占总毛利增量 "+r.share.toFixed(1)+"%。这是报表可计算的结构贡献，不能据此确定销量、价格或汇率各自的因果贡献。",ids:["E2","E4"]};
 if(/未来|持续|预测|下一/.test(question))return {text:"当前材料只能验证历史数据，无法验证未来持续性。请补充后续可比财报、产品周期和渠道去化材料。",ids:["E5"]};
 return {text:"现有证据无法可靠回答此问题。可将问题保存为研究任务，补充原始材料后再验证。",ids:["E5","E6"]};
}
function validateAI(v,ids){
 if(!v||typeof v.summary!=="string"||!Array.isArray(v.questions)||!v.questions.length||v.questions.length>8)throw Error("模型返回格式不合规，未采纳");
 if(!Array.isArray(v.citations)||!v.citations.length||v.citations.some(x=>!ids.includes(x)))throw Error("模型引用不存在的证据，已拒绝采纳");
 if(v.questions.some(q=>typeof q!=="string"||q.length>400)||v.summary.length>2500)throw Error("模型输出过长或子问题格式错误");
 return v;
}
const api={analyze,answer,validateData,validateAI,checkThesis,pct,fmt,names};
if(typeof module!=="undefined")module.exports=api;else root.ResearchEngine=api;
})(typeof window!=="undefined"?window:globalThis);