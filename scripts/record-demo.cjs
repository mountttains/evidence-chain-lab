const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const ctx=await b.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,recordVideo:{dir:'artifacts/raw-video',size:{width:1440,height:1000}},acceptDownloads:true});
 const p=await ctx.newPage();
 await p.goto(process.env.DEMO_URL||'http://127.0.0.1:4173');
 const caption=async(title,text)=>p.evaluate(({title,text})=>{
 let c=document.querySelector('#demo-caption');
 if(!c){c=document.createElement('div');c.id='demo-caption';c.style.cssText='position:fixed;bottom:20px;left:240px;right:28px;z-index:9999;padding:17px 23px;background:rgba(18,31,54,.96);color:#fff;border-radius:12px;box-shadow:0 8px 30px #0003;pointer-events:none;font:18px/1.8 Microsoft YaHei,sans-serif;';document.body.append(c);}
 const host=document.querySelector("dialog[open]")||document.body;if(c.parentNode!==host)host.append(c); c.replaceChildren();const a=document.createElement('strong');a.textContent=title;a.style.color='#a8c4ff';const d=document.createElement('div');d.textContent=text;c.append(a,d);
 },{title,text});
 const hold=ms=>p.waitForTimeout(ms);
 await caption('01 / 从投资判断开始','真实 Apple 历史财报案例。先澄清比较期间和“盈利”的财务口径。');await hold(8500);
 await p.click('#analyze');await caption('02 / 拆解，而不是直接给答案','六个可验证子问题：利润、主营贡献、一次性项目、毛利率、持续性、独立信源。');await p.locator('#questions').scrollIntoViewIfNeeded();await hold(8500);
 await p.locator('#evidence').scrollIntoViewIfNeeded();await caption('03 / 同时保留支持、反对与缺口','支持不等于证明。没有后续材料的持续性，以及独立信源，都标为无法验证。');await hold(6500);
 await p.click('[data-filter="unknown"]');await hold(3500);await p.click('[data-filter="all"]');await p.locator('.ev[data-evidence="E2"]').click();await caption('04 / 每条证据可追溯','服务业务贡献约 92.8% 的毛利增量。可查看计算方式、财报页码和原始 PDF 链接。');await hold(9000);await p.click('#close-modal');
 await p.click('#conflict-detail');await caption('05 / 解释冲突，保留边界','营业利润增长与净利润下降可以同时成立。官方资料披露一次性所得税费用。');await hold(9000);await p.click('#close-modal');
 await p.click('#save');await p.selectOption('#metric','net');await p.click('#analyze');await p.locator('#headline').scrollIntoViewIfNeeded();await caption('06 / 改变口径，结论随之改变','切换到 GAAP 净利润后，结论从“部分支持”变成“反对当前口径”。');await hold(8000);await p.click('#save');
 await p.click('[data-view="history"]');await caption('07 / 保存研究，并比较版本','保存的是当时的命题、期间、指标和结论。不同利润口径的差异清晰可见。');await hold(8000);
 await p.click('[data-view="workbench"]');await p.click('#revise');await p.fill('#followup','未来盈利改善能否持续？');await p.click('#ask');await p.locator('#answer').scrollIntoViewIfNeeded();await caption('08 / 把无法验证的判断变成任务','证据不足时明确回答未知。将问题保存为任务，等待后续财报和独立材料。');await hold(5000);await p.click('#make-task');await p.click('[data-view="tasks"]');await hold(4500);
 await p.click('[data-view="workbench"]');await p.click('#failure');await p.waitForSelector('#retry');await p.evaluate(()=>window.scrollTo(0,0));await caption('09 / 接口异常不产生虚假数据','数据请求失败后保留已核验快照，明确提示错误；重试正常接口后恢复。');await hold(7500);await p.click('#retry');await hold(2000);
 await p.click('#export');await p.click('#settings');await caption('10 / 明确 AI 与合规边界','默认规则验证；可连接自有模型。密钥仅在内存，模型输出须核验；不提供买卖建议。');await hold(8500);await p.click('#close-modal');
 await caption('溯证 TRACE LAB / 演示结束','已演示：命题修订 → 真实证据 → 冲突解释 → 版本比较 → 任务保存 → 异常恢复 → 研究导出。');await hold(6500);
 const video=p.video();await ctx.close();console.log('VIDEO '+await video.path());await b.close();
})().catch(e=>{console.error(e);process.exit(1)});