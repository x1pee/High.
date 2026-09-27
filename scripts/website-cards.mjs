import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'..');
const input=path.resolve(root,'../../work/website-screenshots-en');
const output=path.resolve(root,'../High-media-en');
await fs.mkdir(path.join(output,'raw'),{recursive:true});
const cards=[
 ['01-chart','Your life. In perspective.','Turn everyday moments into a story you can see.','01 / SEE YOUR JOURNEY'],
 ['02-add-event','A moment worth keeping.','Write it down. Choose its impact. Make it part of your story.','02 / CAPTURE A MOMENT'],
 ['03-journal','More than a number.','Keep the words, the small wins, and the days behind your chart.','03 / REMEMBER THE DETAILS']
];
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
const page=await browser.newPage({viewport:{width:2400,height:1600},deviceScaleFactor:1});
for(const [name,title,subtitle,step] of cards){
 const file=await fs.readFile(path.join(input,name+'.png'));
 await fs.writeFile(path.join(output,'raw',name+'.png'),file);
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><style>
 *{box-sizing:border-box}body{margin:0;background:#090c10;color:#f0f2f6;font-family:Arial,sans-serif;width:2400px;height:1600px;overflow:hidden}
 .grid{position:absolute;inset:0;background:linear-gradient(#26333b25 1px,transparent 1px),linear-gradient(90deg,#26333b25 1px,transparent 1px);background-size:80px 80px;mask-image:linear-gradient(#000,transparent 80%)}
 .glow{position:absolute;width:1500px;height:800px;left:450px;top:600px;background:#124335;filter:blur(200px);opacity:.26}
 header{position:absolute;left:120px;right:120px;top:72px;display:flex;align-items:center;justify-content:space-between;font-family:Consolas,monospace}
 .brand{font-size:42px;font-weight:700}.brand span{color:#f7ad1b}.step{font-size:19px;color:#90a2b8;letter-spacing:3px}
 h1{position:absolute;top:124px;left:120px;margin:0;font-size:80px;letter-spacing:-3px;font-weight:650}
 .subtitle{position:absolute;left:124px;top:230px;margin:0;font-size:27px;color:#99a9bd}
 .screen{position:absolute;top:350px;left:330px;width:1740px;border:1px solid #4b525d;border-radius:17px;overflow:hidden;box-shadow:0 50px 120px #000b,0 0 0 10px #181d2377;background:#101114}
 .screen img{display:block;width:100%;height:auto}
 .foot{position:absolute;left:120px;bottom:45px;color:#6d7d91;font-size:17px;letter-spacing:2px;font-family:Consolas,monospace}
 </style><body><div class="grid"></div><div class="glow"></div><header><div class="brand">High<span>.</span></div><div class="step">${step}</div></header><h1>${title}</h1><p class="subtitle">${subtitle}</p><div class="screen"><img src="data:image/png;base64,${file.toString('base64')}" alt="English High app with sample journal entries"></div><div class="foot">PERSONAL JOURNAL / SAMPLE ENTRIES</div></body></html>`;
 await fs.writeFile(path.join(output,name+'.html'),html);
 await page.setContent(html);await page.locator('img').evaluate(img=>img.decode());
 await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});
 await sharp(path.join(output,name+'.png')).webp({quality:92}).toFile(path.join(output,name+'.webp'));
}
await fs.writeFile(path.join(output,'README.txt'),'High. English screenshots — 27 September 2026\n\nThree website cards: 2400 x 1600, PNG and WebP.\nraw/ contains original 3200 x 2100 screenshots.\nScreenshots show the actual English frontend with isolated fictional sample data.\nHTML files reproduce each presentation card. No personal journals were used.\nThis is a development preview, not a published 2.0 release.\n');
console.log(output);
}finally{await browser.close();}
