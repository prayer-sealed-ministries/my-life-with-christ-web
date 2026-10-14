// Optional rendered-browser QA. Uses installed Playwright and axe packages, never a public deployment.
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.join(process.env.LWC_QA_PACKAGE_ROOT||process.cwd(),'package.json'));
const {chromium}=require('@playwright/test');const AxeBuilder=require('@axe-core/playwright').default;
const root=path.resolve('dist');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.md':'text/markdown'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),filename=path.resolve(root,'.'+rel);if(!filename.startsWith(root+path.sep))throw Error();const body=await readFile(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
assert.equal((await fetch(base)).status,200);await mkdir('.test-tmp/browser',{recursive:true});
let browser;
const results=[];
try{
 // Default to the Chromium Playwright installed for this package rather than a
 // hardcoded /usr/bin/chromium. That path is why this harness had never run: it
 // is absent on macOS and on a GitHub runner, and the one environment that did
 // provide it denied the launch outright ("Operation not permitted" on a
 // required Unix socket). CHROMIUM_PATH still overrides for a system browser.
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
 }catch(cause){
  // Rethrown, never swallowed. An unavailable browser must fail this harness
  // loudly; a quiet exit would let "no rendered check ran" read as a pass.
  throw new Error(`Could not launch Chromium for the rendered-browser harness. Install it with \`npx playwright install chromium\`, or set CHROMIUM_PATH to an executable. Underlying failure: ${cause.message}`,{cause});
 }
 const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});const page=await context.newPage();const errors=[],requests=[];
 page.on('pageerror',err=>errors.push(err.message));page.on('request',req=>requests.push(req.url()));
 await page.goto(base);await page.evaluate(()=>window.lwcReady);
 for(const route of ['home','journal','transfer','import','church','privacy','guide','format','write/sermon']){
  await page.goto(base+'/#'+route);await page.waitForTimeout(80);await page.waitForFunction(()=>document.querySelectorAll('main h1').length===1);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();results.push({route,violations:result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
 }
 await page.goto(base+'/#church');await page.waitForSelector('#pack-form');await page.fill('#pack-title','Fictional Sunday outline');await page.fill('#pack-church','Fictional Example Church');await page.fill('#pack-speaker','Fictional Pastor');await page.fill('#pack-scripture','Luke 14:12–14');await page.fill('#pack-body','## A shared table\n\nFictional outline for testing only.');await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Draft saved on this device');await page.click('[data-action="preview-pack"]');await page.waitForSelector('dialog[open]');assert.match(await page.locator('#dialog-body').textContent(),/Fictional Sunday/);await page.keyboard.press('Escape');assert.equal(await page.locator('[data-action="preview-pack"]').evaluate(e=>e===document.activeElement),true);
 const packDownload=page.waitForEvent('download');await page.click('#pack-form [type="submit"]');const pack=await packDownload;await pack.saveAs('.test-tmp/browser/fictional-sermon.json');
 await page.goto(base+'/#import');await page.waitForSelector('[data-action="pick-sermon"]');await page.locator('#file-picker').setInputFiles('.test-tmp/browser/fictional-sermon.json');await page.waitForSelector('[data-action="confirm-sermon"]');await page.click('[data-action="confirm-sermon"]');await page.waitForSelector('#entry-form');assert.equal(await page.inputValue('#notes'),'');assert.equal(await page.inputValue('#reflection'),'');await page.fill('#notes','Fictional notes');await page.fill('#reflection','Fictional private reflection');await page.fill('#prayer','Fictional private prayer');await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Draft saved on this device');await page.reload();await page.waitForSelector('#entry-form');assert.equal(await page.inputValue('#prayer'),'Fictional private prayer');await page.click('#entry-form [type="submit"]');await page.waitForSelector('[data-action="markdown"]');
 await page.click('[data-action="markdown"]');assert.equal(await page.isChecked('#share-reflection'),false);assert.equal(await page.isChecked('#share-prayer'),false);assert.ok(!(await page.locator('#share-preview').textContent()).includes('Fictional private'));const readableDownload=page.waitForEvent('download');await page.click('#share-download');await (await readableDownload).saveAs('.test-tmp/browser/fictional-readable.md');
 await page.goto(base+'/#transfer');await page.waitForSelector('[data-action="export-app"]');await page.click('[data-action="export-app"]');const transferDownload=page.waitForEvent('download');await page.click('#download-confirm');await (await transferDownload).saveAs('.test-tmp/browser/fictional-journey.json');
 await page.goto(base+'/#import');await page.waitForSelector('[data-action="pick-journal"]');await page.locator('#file-picker').setInputFiles('tests/fixtures/protected-v1.lwc');await page.waitForSelector('#unlock-password');const fixture=JSON.parse(await readFile('tests/fixtures/protected-v1.metadata.json','utf8'));await page.fill('#unlock-password',fixture.password);await page.click('#unlock-form [type="submit"]');await page.waitForSelector('[data-action="confirm-import"]');await page.click('[data-action="confirm-import"]');await page.waitForFunction(()=>document.querySelector('#main').textContent.includes('1 entries saved'));await page.goto(base+'/#import');await page.locator('#file-picker').setInputFiles('tests/fixtures/protected-v1.journey.json');await page.waitForSelector('[data-action="confirm-import"]');await page.click('[data-action="confirm-import"]');await page.waitForFunction(()=>document.querySelector('#main').textContent.includes('0 entries saved'));
 for(const width of [1280,390,320]){await page.setViewportSize({width,height:900});for(const route of ['home','journal','transfer','church','privacy']){await page.goto(base+'/#'+route);await page.waitForTimeout(80);const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));assert.ok(dimensions.scroll<=dimensions.inner+1,`${route} overflows at ${width}: ${JSON.stringify(dimensions)}`);}await page.goto(base+'/#home');await page.waitForTimeout(80);await page.screenshot({path:`.test-tmp/browser/home-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:1280,height:900});await page.goto(base+'/#transfer');await page.waitForTimeout(80);await page.screenshot({path:'.test-tmp/browser/transfer-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.ok(requests.every(url=>url.startsWith(base)||url.startsWith('blob:')), 'Unexpected external runtime request');
 console.log(JSON.stringify({chromium:browser.version(),checks:['nine routes axe WCAG tags','pastor preview/download','provided-notes import','autosave/reload','readable privacy defaults','browser journal download','protected fixture unlock','repeat import receipt','five routes at 1280/390/320px reflow','dialog Escape/focus restoration','no page errors','no external runtime requests'],accessibility:results},null,2));
 const violations=results.flatMap(r=>r.violations.map(v=>({...v,route:r.route})));assert.equal(violations.length,0,'Axe violations: '+JSON.stringify(violations));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
