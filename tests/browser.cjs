const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
 const page=await context.newPage(),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.TEST_URL||'http://127.0.0.1:4173';
 const check=async(name,fn)=>{await fn();results.push({name,status:'passed'});console.log('PASS '+name);};
 try{
 await page.goto(base);
 await check('initial real-data result',async()=>{assert.match(await page.locator('#metrics').innerText(),/7.80%/);assert.match(await page.locator('#conclusion').innerText(),/3.36%/);});
 await check('edit metric and save two actual versions',async()=>{
 await page.click('#save');await page.selectOption('#metric','net');await page.click('#analyze');assert.equal(await page.locator('#verdict').innerText(),'反对当前口径');await page.click('#save');
 await page.click('[data-view="history"]');assert.equal(await page.locator('.snapshot').count(),2);assert.match(await page.locator('#comparison').innerText(),/口径发生变化/);
 });
 await check('source evidence detail has original URL',async()=>{
 await page.click('[data-view="workbench"]');await page.click('#conflict-detail');assert.match(await page.locator('#modal-body').innerText(),/10.2 billion/);assert.match(await page.locator('#modal-body a').getAttribute('href'),/apple.com.*pdf#page=4/);await page.click('#close-modal');
 });
 await check('filter and data table navigation work',async()=>{
 await page.click('[data-filter="unknown"]');assert.equal(await page.locator('.ev').count(),2);
 await page.click('[data-view="library"]');assert.equal(await page.locator('tbody tr').count(),9);await page.click('[data-view="workbench"]');await page.click('[data-filter="all"]');
 });
 await check('followup, task persistence and completion',async()=>{
 await page.fill('#followup','渠道去化能否持续？');await page.click('#ask');assert.match(await page.locator('#answer').innerText(),/无法验证/);await page.click('#make-task');
 await page.reload();await page.click('[data-view="tasks"]');assert.equal(await page.locator('.task').count(),1);await page.check('.task input');assert.equal(await page.locator('#task-count').innerText(),'0');await page.reload();await page.click('[data-view="tasks"]');assert(await page.locator('.task input').isChecked());
 });
 await check('data failure preserves result and retry clears warning',async()=>{
 await page.click('[data-view="workbench"]');await page.click('#failure');await page.waitForSelector('#retry');assert.match(await page.locator('#notice').innerText(),/没有生成/);assert.match(await page.locator('#metrics').innerText(),/7.80%/);await page.click('#retry');await page.waitForFunction(()=>document.querySelector('#notice').textContent==='');
 });
 await check('exports actual research JSON, not toast only',async()=>{
 const promise=page.waitForEvent('download');await page.click('#export');const d=await promise;const file=await d.path();const json=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(json.tasks.length,1);assert.equal(json.versions.length,2);assert.equal(json.data.annual.current.net,93736);assert(!JSON.stringify(json).includes('Bearer'));
 });
 await check('unsupported thesis leaves old result intact',async()=>{
 await page.fill('#thesis','茅台 2025 年盈利改善来自主营业务');await page.click('#analyze');assert.match(await page.locator('#toast').innerText(),/Apple/);await page.click('#revise');
 });
 await check('mocked model success is labeled and citations validated',async()=>{
 await page.route('https://model.example.test/chat/completions',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'历史经营改善得到证据支持，持续性未知。',questions:['未来能否持续？'],citations:['E1','E5']})}}]})}));
 await page.click('#settings');await page.fill('#endpoint','https://model.example.test/chat/completions');await page.fill('#model','test-only-model');await page.fill('#api-key','test-key-not-real');await page.click('#connect');await page.click('#ai-analyze');await page.waitForFunction(()=>document.querySelector('#modal-title').textContent.includes('模型辅助分析'));assert.match(await page.locator('#modal-body').innerText(),/未验证模型所有语义/);await page.click('#close-modal');
 assert(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes('test-key-not-real'));
 });
 await check('model authorization failure falls back',async()=>{
 await page.unroute('https://model.example.test/chat/completions');await page.route('https://model.example.test/chat/completions',r=>r.fulfill({status:401,body:'Unauthorized'}));await page.click('#ai-analyze');await page.waitForFunction(()=>document.querySelector('#mode').textContent.includes('模型失败'));assert.match(await page.locator('#metrics').innerText(),/7.80%/);
 });
 await check('model nonexistent citation rejected',async()=>{
 await page.unroute('https://model.example.test/chat/completions');await page.route('https://model.example.test/chat/completions',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'bad',questions:['q'],citations:['E999']})}}]})}));await page.click('#ai-analyze');await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('引用不存在'));assert.match(await page.locator('#mode').innerText(),/模型失败/);
 });
 await page.reload();await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
 await check('mobile no horizontal overflow',async()=>{
 await page.setViewportSize({width:390,height:844});await page.reload();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
 });
 assert.deepEqual(errors,[]);
 fs.writeFileSync('artifacts/browser-test-results.json',JSON.stringify({runAt:new Date().toISOString(),url:base,results,uncaughtErrors:errors,modelTests:'mocked only, no real inference credentials'},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});