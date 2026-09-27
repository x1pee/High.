import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parse } from 'acorn';
import { execFileSync } from 'node:child_process';
import { readLanguage, saveLanguage, translateStatic, interfaceFragments } from '../src/i18n.mjs';
import english from '../src/locale-en.mjs';

test('language preference falls back safely and persists supported choices', () => {
  assert.equal(readLanguage({getItem(){throw Error('blocked');}}), 'ru');
  let saved;
  const storage={getItem:()=>saved,setItem:(_key,v)=>saved=v};
  saveLanguage('en',storage); assert.equal(readLanguage(storage),'en');
  assert.throws(()=>saveLanguage('de',storage));
  assert.equal(translateStatic('Добавить событие','en'),'Add event');
});

test('English templates preserve interpolated journal content and localize all example pools', () => {
  const result=execFileSync(process.execPath,['--input-type=module','-e',`
    globalThis.localStorage={getItem:()=> 'en'};
    const {localizeUI,locale}=await import('./src/i18n.mjs');
    const user='Сегодня <script> & Мой путь';
    const result=localizeUI\`<b>Событие</b>\${user}\`;
    const {EVENT_EXAMPLES,EXAMPLE_CATEGORIES}=await import('./src/event-examples.mjs');
    const {DAY_PROMPTS}=await import('./src/day-examples.mjs');
    const {CHART_PHRASES}=await import('./src/chart-phrases.mjs');
    console.log(JSON.stringify({result,locale,count:EVENT_EXAMPLES.length,text:JSON.stringify([EVENT_EXAMPLES,EXAMPLE_CATEGORIES,DAY_PROMPTS,CHART_PHRASES])}));
  `],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  const data=JSON.parse(result);
  assert.equal(data.result,'<b>Event</b>Сегодня <script> & Мой путь');
  assert.equal(data.locale,'en-US'); assert.equal(data.count,500);
  assert.doesNotMatch(data.text,/[А-Яа-яЁё]/);
});

test('every localized source fragment has English copy', async () => {
  const missing=new Set();
  const inspect=text=>{for(const m of text.matchAll(interfaceFragments)){const key=m[0].trimEnd();if(!(key in english))missing.add(key);}};
  function visit(node,parent) {
    if(!node || typeof node!=='object') return;
    if(node.type==='CallExpression' && node.callee.name==='localizeUI')
      for(const arg of node.arguments)if(arg.type==='Literal'&&typeof arg.value==='string')inspect(arg.value);
    if(node.type==='TaggedTemplateExpression' && node.tag.name==='localizeUI')
      node.quasi.quasis.forEach(q=>inspect(q.value.cooked));
    for(const value of Object.values(node)) {
      if(Array.isArray(value)) value.forEach(v=>visit(v,node));
      else if(value && typeof value==='object')visit(value,node);
    }
  }
  const root=new URL('../src/',import.meta.url);
  for(const file of await fs.readdir(root))if(file.endsWith('.mjs'))
    visit(parse(await fs.readFile(new URL(file,root),'utf8'),{ecmaVersion:'latest',sourceType:'module'}));
  assert.deepEqual([...missing],[]);
});
