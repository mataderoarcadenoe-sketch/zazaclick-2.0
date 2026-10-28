const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{createRequire}=require('module');
const root=path.resolve(process.env.ZAZA_SOURCE_ROOT || path.join(__dirname,'..'));
const deps=createRequire(path.join(root,'package.json')),ts=deps('typescript');
const expected='572176809201-8o2c3qpug8mkik2pvd0bcbp1nk7belks.apps.googleusercontent.com';
async function run(extra){let seen,fail=false;const exported={};
 const source=ts.transpileModule(fs.readFileSync(path.join(root,'src/services/google.service.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{exports:exported,process:{env:{GOOGLE_CLIENT_ID:extra}},console:{error(){}},require(name){
  if(name==='dotenv')return{config(){}};
  if(name==='google-auth-library')return{OAuth2Client:class{async verifyIdToken(options){seen=options;if(fail)throw Error('Fixture invalid signature');return{getPayload:()=>({email:'fixture@example.invalid',email_verified:true})};}}};
  throw Error('Unexpected dependency: '+name);
 }},{timeout:1000});
 const value=await exported.GoogleService.verifyToken('synthetic-token');assert.equal(value.email_verified,true);
 assert.ok(seen.audience.includes(expected),'APK audience must be accepted without environment changes');
 assert.ok(seen.audience.includes('782722800100-4j8107m9nn2r0ngt6b4e17r2s2166l19.apps.googleusercontent.com'));
 assert.ok(seen.audience.includes('6104299697-7dissi3tuvd84q94737nqmsi96nmh2d5.apps.googleusercontent.com'));
 if(extra)assert.ok(seen.audience.includes(extra));assert.equal(new Set(seen.audience).size,seen.audience.length);
 assert.equal(exported.GoogleService.supportsSyscomAndroid(),true);
 fail=true;assert.equal(await exported.GoogleService.verifyToken('invalid-fixture'),null);
}
(async()=>{await run(undefined);await run('fixture-additional.apps.googleusercontent.com');await run(expected);console.log(JSON.stringify({passed:3,nativeAudienceAccepted:true,existingClientsPreserved:true,environmentClientPreserved:true,verificationFailuresRejected:true,networkCalls:false,realCredentialsUsed:false}));})().catch(e=>{console.error(e);process.exit(1)});
