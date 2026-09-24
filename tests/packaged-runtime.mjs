import {_electron as electron} from 'playwright';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const dir=await fs.mkdtemp(path.resolve(import.meta.dirname,'../../../work/updater-runtime-'));const app=await electron.launch({executablePath:path.resolve(import.meta.dirname,'../../../work/build/win-unpacked/Vyshe.exe'),env:{...process.env,ELECTRON_RUN_AS_NODE:undefined,VYSHE_DATA_DIR:dir}});
try{await app.firstWindow();const result=await app.evaluate(async({app})=>{const{createRequire}=process.getBuiltinModule('node:module');const req=createRequire(app.getAppPath()+'/desktop/main.cjs');const{autoUpdater}=req('electron-updater');return{version:app.getVersion(),updater:autoUpdater.constructor.name,updaterVersion:req('electron-updater/package.json').version}});assert.equal(result.version,'1.9.13');assert.equal(result.updater,'NsisUpdater');console.log(result)}finally{await app.close()}



