const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const {createRequire}=require('module');
const dependencies=createRequire(path.join(process.env.ZAZA_TEST_DEPENDENCY_ROOT || path.resolve(__dirname,'..'),'package.json'));
const ts=dependencies('typescript');
const {Pool}=dependencies('pg');
if (process.env.ZAZA_TEST_ALLOW_DISPOSABLE_DB !== '1') throw Error('Set ZAZA_TEST_ALLOW_DISPOSABLE_DB=1 only for a disposable local test cluster.');
// Explicit localhost-only connection: never reads the project's dotenv or DATABASE_URL.
const pool=new Pool({host:'127.0.0.1',port:65429,database:'zaza_hardening_test',user:'zaza_test',password:'',max:24,connectionTimeoutMillis:2000});
const root=path.join(__dirname,'..','src'),cache=new Map(),secret=crypto.randomBytes(48).toString('hex');
let denyDatabase=false,engineCalls=0;
let pacingRedis;
const guardedPool={connect:()=>{if(denyDatabase)throw Error('DB unavailable');return pool.connect();},
  query:(...a)=>{if(denyDatabase)throw Error('DB unavailable');return pool.query(...a);}};
function load(relative){
  const full=path.resolve(root,relative);
  if(cache.has(full))return cache.get(full);
  const exports={};cache.set(full,exports);
  const output=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  vm.runInNewContext(output,{exports,module:{exports},Buffer,Date,JSON,Promise,setTimeout,clearTimeout,console,
    process:{env:{JWT_SECRET:secret}},
    require(name){
      if(name.endsWith('/config/database')||name==='./database')return {__esModule:true,default:guardedPool};
      if(name.endsWith('/config/redis') && pacingRedis) return {__esModule:true,default:pacingRedis};
      if(name==='axios')return {create(){throw Error('External HTTP forbidden in tests');}};
      if(name.includes('redis'))throw Error('Network dependency forbidden: '+name);
      if(name==='dotenv')return {config(){}};
      if(name.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(full),name))+'.ts');
      return dependencies(name);
    }
  },{filename:full,timeout:3000});return exports;
}
const ledger=load('services/message-operation.service.ts'),auth=load('middleware/auth.middleware.ts');
const keyHash=v=>crypto.createHash('sha256').update(v).digest('hex');
const tenant='test-tenant',instance='test-instance',instanceId='test-instance-id',sub='test-sub';
async function reset(){
  denyDatabase=false;engineCalls=0;
  await pool.query('TRUNCATE message_operations,usage_logs,api_keys,instances,subscriptions,partners,users CASCADE');
  await pool.query("INSERT INTO users(id,role,email,status) VALUES ($1,'client','fixture@example.invalid','active'),('other','client','other@example.invalid','active')",[tenant]);
  await pool.query("INSERT INTO subscriptions(id,user_id,status,end_date,messages_limit,messages_used,plan_id) VALUES ($1,$2,'active',CURRENT_TIMESTAMP+INTERVAL '1 day',100,0,'test-plan')",[sub,tenant]);
  await pool.query("INSERT INTO instances(id,user_id,instance_name,is_enabled,api_key,token,engine_type,messages_sent) VALUES ($1,$2,$3,true,'instance-fixture-secret','instance-fixture-secret','evolution_go',0)",[instanceId,tenant,instance]);
  await pool.query("INSERT INTO api_keys(id,user_id,key_hash,is_active,scopes,environment) VALUES ('test-key',$1,$2,true,'[\"messages:send\",\"instances:read\",\"logs:read\"]','live')",[tenant,keyHash('fixture-key')]);
}
function request({key='test-operation',token='fixture-key',text='fixture',mode='accept',instanceName=instance}={}){
  const req={headers:{'x-api-key':token,'idempotency-key':key},body:{instanceName,number:'51900000000',text},params:{},path:'/messages/text'};
  let status=200,body,context,headers={};
  const res={status(v){status=v;return this;},json(v){body=v;return this;},setHeader(k,v){headers[k]=v;}};
  return load('middleware/licensing.middleware.ts').licensingMiddleware(req,res,async()=>{
    engineCalls++;context=req.licensingContext;
    if(mode==='accept') {await context.confirmSuccess('text','fixture-message',{success:true,messageId:'fixture-message'});res.json({success:true,messageId:'fixture-message'});}
    else if(mode==='timeout'){await context.rollback('text','timeout');res.status(504).json({success:false});}
    else if(mode==='invalid'){await context.rollback('text','INVALID_PARAMS');res.status(400).json({success:false});}
    else if(mode==='leave'){} // Simulated process interruption after reserving, before response.
  }).then(()=>({status,body,headers,context}));
}
const results=[];
async function test(name,fn){await reset();await fn();results.push(name);console.log('PASS',name);}
async function main(){
  const identity=(await pool.query('SELECT current_database() AS name,current_user AS owner')).rows[0];
  assert.equal(identity.name,'zaza_hardening_test');assert.equal(identity.owner,'zaza_test');
  await pool.query('DROP TABLE IF EXISTS message_operations');
  await pool.query(`CREATE TABLE IF NOT EXISTS users(id VARCHAR(255) PRIMARY KEY,parent_id VARCHAR(255),role TEXT,email TEXT,status TEXT,partner_id VARCHAR(255));
    CREATE TABLE IF NOT EXISTS partners(id VARCHAR(255),master_key_hash TEXT,master_key TEXT,is_active BOOLEAN);
    CREATE TABLE IF NOT EXISTS subscriptions(id VARCHAR(255) PRIMARY KEY,user_id VARCHAR(255),status TEXT,end_date TIMESTAMPTZ,messages_limit INT,messages_used INT,plan_id TEXT,created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS instances(id VARCHAR(255) PRIMARY KEY,user_id VARCHAR(255),instance_name TEXT,name TEXT,engine_type TEXT,is_enabled BOOLEAN,api_key TEXT,token TEXT,messages_sent INT,last_activity_at TIMESTAMPTZ);
    CREATE TABLE IF NOT EXISTS api_keys(id VARCHAR(255),user_id VARCHAR(255),key_hash TEXT,is_active BOOLEAN,scopes JSONB,environment TEXT,last_used_at TIMESTAMPTZ);
    CREATE TABLE IF NOT EXISTS usage_logs(id TEXT,user_id TEXT,subscription_id TEXT,instance_name TEXT,message_type TEXT,status VARCHAR(20),evolution_message_id TEXT);`);
  await pool.query(load('config/message-operations-schema.ts').MESSAGE_OPERATIONS_SCHEMA);
  await test('40 concurrent same-key requests reach the fake engine once and consume one quota',async()=>{
    const r=await Promise.all(Array.from({length:40},()=>request()));
    assert.equal(engineCalls,1);assert.equal(r.filter(x=>x.status===200).length>=1,true);
    assert.equal((await pool.query('SELECT messages_used FROM subscriptions')).rows[0].messages_used,1);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM message_operations')).rows[0].count,1);
  });
  await test('successful retry replays the original message without a second delivery',async()=>{
    const first=await request(),second=await request();assert.equal(engineCalls,1);
    assert.equal(second.body._cachedIdempotent,true);assert.equal(first.body.operationId,second.body.operationId);
  });
  await test('changed content with the same key is rejected',async()=>{
    await request();const r=await request({text:'different'});assert.equal(r.status,409);assert.equal(r.body.code,'IDEMPOTENCY_PAYLOAD_MISMATCH');assert.equal(engineCalls,1);
  });
  await test('invalid credentials cannot read an accepted cached response',async()=>{
    await request();const r=await request({token:'invalid'});assert.equal(r.status,401);assert.equal(r.body.messageId,undefined);assert.equal(engineCalls,1);
  });
  await test('invalid credential never reserves or poisons a key',async()=>{
    assert.equal((await request({token:'invalid'})).status,401);assert.equal((await request()).status,200);assert.equal(engineCalls,1);
  });
  await test('database unavailable fails closed with no fake-engine invocation',async()=>{
    denyDatabase=true;const r=await request();denyDatabase=false;assert.equal(r.status,503);assert.equal(engineCalls,0);
  });
  await test('uncertain timeout stays UNKNOWN and is never retried or refunded automatically',async()=>{
    const first=await request({mode:'timeout'}),retry=await request();assert.equal(first.body.deliveryState,'UNKNOWN');
    assert.equal(retry.status,409);assert.equal(retry.body.code,'DELIVERY_UNCERTAIN');assert.equal(engineCalls,1);
    assert.equal((await pool.query('SELECT messages_used FROM subscriptions')).rows[0].messages_used,1);
  });
  await test('known pre-engine validation failure refunds once and remains cached',async()=>{
    const first=await request({mode:'invalid'});await first.context.rollback('text','INVALID_PARAMS');const retry=await request();
    assert.equal(engineCalls,1);assert.equal(retry.status,400);assert.equal((await pool.query('SELECT messages_used FROM subscriptions')).rows[0].messages_used,0);
  });
  await test('interrupted PROCESSING operation survives a new loader and blocks resending',async()=>{
    await request({mode:'leave'});cache.clear();
    const replayed=await request();assert.equal(replayed.status,409);assert.equal(replayed.body.deliveryState,'PROCESSING');assert.equal(engineCalls,1);
  });
  await test('quota limit is atomic across distinct operations',async()=>{
    await pool.query('UPDATE subscriptions SET messages_limit=3');
    const r=await Promise.all(Array.from({length:12},(_,i)=>request({key:'key-'+i})));
    assert.equal(engineCalls,3);assert.equal(r.filter(x=>x.status===429).length,9);assert.equal((await pool.query('SELECT messages_used FROM subscriptions')).rows[0].messages_used,3);
  });
  await test('missing messages:send scope blocks delivery',async()=>{
    await pool.query("UPDATE api_keys SET scopes='[\"instances:read\"]'");assert.equal((await request()).status,403);assert.equal(engineCalls,0);
  });
  await test('test API keys cannot deliver real WhatsApp messages',async()=>{
    await pool.query("UPDATE api_keys SET environment='test'");assert.equal((await request()).body.code,'TEST_KEY_SEND_DISABLED');assert.equal(engineCalls,0);
  });
  await test('valid session JWT can send without extracting an instance secret',async()=>{
    const jwt=dependencies('jsonwebtoken').sign({id:tenant,role:'admin',tenantId:'other'},secret,{expiresIn:'1h'});
    const r=await request({token:jwt});assert.equal(r.status,200);assert.equal(engineCalls,1);
  });
  await test('JWT cannot forge tenant membership or preserve an old admin role',async()=>{
    const jwt=dependencies('jsonwebtoken').sign({id:tenant,role:'admin',tenantId:'other'},secret,{expiresIn:'1h'});
    const p=await auth.authenticate(jwt);assert.equal(p.userId,tenant);assert.equal(p.role,'client');
  });
  await test('blocked current account invalidates an existing JWT',async()=>{
    const jwt=dependencies('jsonwebtoken').sign({id:tenant},secret,{expiresIn:'1h'});await pool.query("UPDATE users SET status='blocked' WHERE id=$1",[tenant]);
    assert.equal((await request({token:jwt})).status,401);assert.equal(engineCalls,0);
  });
  await test('instance credentials cannot send through a sibling instance',async()=>{
    await pool.query("INSERT INTO instances(id,user_id,instance_name,is_enabled,messages_sent) VALUES ('sibling',$1,'sibling',true,0)",[tenant]);
    assert.equal((await request({token:'instance-fixture-secret',instanceName:'sibling'})).status,403);assert.equal(engineCalls,0);
  });
  await test('disabled instance cannot send even with an accepted cached operation',async()=>{
    await request();await pool.query('UPDATE instances SET is_enabled=false');assert.equal((await request()).status,403);assert.equal(engineCalls,1);
  });
  await test('keys and PDF bodies are removed from recursive API logging',async()=>{
    const redacted=load('services/api-log.service.ts').ApiLogService.sanitizeData({credential:'secret',media:'PDF',nested:{authorization:'Bearer fixture',audio:'audio'},normal:'kept'});
    assert.equal(redacted.credential,'[REDACTED]');assert.equal(redacted.media,'[REDACTED]');assert.equal(redacted.nested.audio,'[REDACTED]');assert.equal(redacted.normal,'kept');
  });
  await test('late duplicate callbacks cannot downgrade ACCEPTED or refund its quota',async()=>{
    const first=await request();await first.context.rollback('text','INVALID_PARAMS');
    const again=await request();assert.equal(again.body.deliveryState,'ACCEPTED');assert.equal(engineCalls,1);
    assert.equal((await pool.query('SELECT messages_used FROM subscriptions')).rows[0].messages_used,1);
    assert.equal((await pool.query('SELECT messages_sent FROM instances')).rows[0].messages_sent,1);
  });
  await test('a failed outcome transaction leaves a recoverable operation rather than allowing a resend',async()=>{
    const begin=await ledger.MessageOperationService.begin(tenant,instanceId,sub,'failure-case',ledger.requestHash('text',{text:'fixture'}),'live');
    await pool.query("ALTER TABLE usage_logs ADD CONSTRAINT fixture_log_failure CHECK (message_type <> 'fixture-fail')");
    try {await assert.rejects(()=>ledger.MessageOperationService.finish(begin.operation,'ACCEPTED','fixture-fail',{success:true},200));}
    finally {await pool.query('ALTER TABLE usage_logs DROP CONSTRAINT fixture_log_failure');}
    assert.equal((await pool.query('SELECT state FROM message_operations')).rows[0].state,'PROCESSING');
    assert.equal((await pool.query('SELECT messages_sent FROM instances')).rows[0].messages_sent,0);
    const retry=await ledger.MessageOperationService.begin(tenant,instanceId,sub,'failure-case',ledger.requestHash('text',{text:'fixture'}),'live');assert.equal(retry.fresh,false);
  });
  await test('PDF data URI and raw base64 are accepted without uploading to a public URL',async()=>{
    const {outgoingDocumentError}=load('utils/outgoing-document.util.ts');
    const data=Buffer.from('%PDF-1.7\nfixture\n%%EOF').toString('base64');
    assert.equal(outgoingDocumentError({mediatype:'document',mimetype:'application/pdf',media:'data:application/pdf;base64,'+data,fileName:'ticket.pdf'}),null);
    assert.equal(outgoingDocumentError({mediatype:'document',mimetype:'application/pdf',media:data}),null);
  });
  await test('truncated, mismatched, oversized and unsafe-name PDF inputs are rejected',async()=>{
    const {outgoingDocumentError:invalid}=load('utils/outgoing-document.util.ts');
    const valid={mediatype:'document',mimetype:'application/pdf',media:Buffer.from('%PDF-1.7\nfixture\n%%EOF').toString('base64')};
    assert.ok(invalid({...valid,media:Buffer.from('%PDF-1.7').toString('base64')}));
    assert.ok(invalid({...valid,mediatype:'image'}));assert.ok(invalid({...valid,fileName:'../ticket.pdf'}));
    assert.ok(invalid({...valid,media:'A'.repeat(Math.ceil(8*1024*1024/3)*4+4)}));
  });
  await test('the same key in a different tenant cannot expose or consume another tenant operation',async()=>{
    await request();await pool.query("UPDATE api_keys SET user_id='other'");
    const r=await request();assert.equal(r.status,403);assert.equal(r.body.messageId,undefined);assert.equal(engineCalls,1);
  });
  await test('body field order has a stable fingerprint while the recipient changes it',async()=>{
    assert.equal(ledger.requestHash('media',{number:'51',media:'pdf'}),ledger.requestHash('media',{media:'pdf',number:'51'}));
    assert.notEqual(ledger.requestHash('media',{number:'51',media:'pdf'}),ledger.requestHash('media',{number:'52',media:'pdf'}));
  });
  await test('operation status is private, works by original key, and never asserts delivered/read',async()=>{
    const sent=await request();
    const router=load('routes/message-operation.routes.ts').default;
    const handler=router.stack.find(x=>x.route?.path==='/by-key/:instanceName/:key').route.stack[0].handle;
    async function read(userId){let status=200,body;const headers={};
      await handler({principal:{userId,role:'client',environment:'live'},params:{instanceName:instance,key:'test-operation'}},
        {status(v){status=v;return this;},json(v){body=v;return this;},setHeader(k,v){headers[k]=v;}});
      return {status,body,headers};}
    const own=await read(tenant),foreign=await read('other');
    assert.equal(own.body.data.operationId,sent.body.operationId);assert.equal(own.body.data.delivered,null);assert.equal(own.body.data.read,null);
    assert.equal(own.headers['Cache-Control'],'no-store');assert.equal(foreign.status,404);assert.equal(engineCalls,1);
  });
  await test('old PROCESSING status requests a review and cannot trigger another engine call',async()=>{
    await request({mode:'leave'});await pool.query("UPDATE message_operations SET updated_at=CURRENT_TIMESTAMP-INTERVAL '3 minutes'");
    const router=load('routes/message-operation.routes.ts').default;
    const handler=router.stack.find(x=>x.route?.path==='/by-key/:instanceName/:key').route.stack[0].handle;
    let body;await handler({principal:{userId:tenant,environment:'live'},params:{instanceName:instance,key:'test-operation'}},
      {status(){return this;},json(v){body=v;return this;},setHeader(){}});
    assert.equal(body.data.reviewRequired,true);assert.equal(body.data.state,'PROCESSING');assert.equal(engineCalls,1);
  });
  await test('legacy Redis keys become durable tombstones without sending or charging again',async()=>{
    const importer=load('jobs/import-legacy-message-operations.ts').importLegacyOperations;
    const legacy={scan:async()=>['0',['idemp:test-instance:old-operation']],get:async()=>JSON.stringify({status:'SUCCESS',response:{messageId:'old-message'}})};
    await importer(pool,legacy);await importer(pool,legacy);
    const operation=(await pool.query('SELECT * FROM message_operations')).rows[0];
    assert.equal(operation.state,'UNKNOWN');assert.equal(operation.message_id,'old-message');
    assert.equal(ledger.replay(operation,ledger.requestHash('text',{text:'fixture'})).status,409);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM message_operations')).rows[0].n,1);
    assert.equal((await pool.query('SELECT messages_used FROM subscriptions')).rows[0].messages_used,0);assert.equal(engineCalls,0);
  });
  await test('Google login rejects an unverified email without creating a user',async()=>{
    const google=load('services/google.service.ts').GoogleService;
    const original=google.verifyToken;google.verifyToken=async()=>({email:'unverified@example.invalid',email_verified:false});
    try {
      const route=load('routes/auth.routes.ts').default.stack.find(x=>x.route?.path==='/google-login').route.stack[0].handle;
      let status=200;await route({body:{credential:'fixture'}},{status(v){status=v;return this;},json(){return this;}});
      assert.equal(status,401);assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n,2);
    } finally {google.verifyToken=original;}
  });
  await test('socket requires authentication and validates instance ownership before joining a room',async()=>{
    const server=require('http').createServer();
    const io=load('config/socket.ts').initSocket(server);
    try {
      const middleware=io.sockets._fns[0];
      const anonymous={handshake:{auth:{}},data:{}};
      assert.ok(await new Promise(resolve=>middleware(anonymous,resolve)));
      const token=dependencies('jsonwebtoken').sign({id:tenant},secret,{expiresIn:'1h'});
      const events={},joined=[];
      const socket={id:'fixture-socket',handshake:{auth:{token}},data:{},on(name,fn){events[name]=fn;},join:async room=>joined.push(room)};
      assert.equal(await new Promise(resolve=>middleware(socket,resolve)),undefined);
      io.sockets.listeners('connection')[0](socket);
      let ack;await events.join_instance('other-instance',value=>ack=value);assert.equal(ack.ok,false);assert.equal(joined.length,0);
      await events.join_instance(instance,value=>ack=value);assert.equal(ack.ok,true);assert.equal(joined[0],'instance_'+instance);
      await pool.query("UPDATE users SET status='blocked' WHERE id=$1",[tenant]);
      await events.join_instance(instance,value=>ack=value);assert.equal(ack.ok,false);assert.equal(joined.length,1);
    } finally {io.close();}
  });
  await test('unavailable Redis pacing fails closed instead of hanging or silently sending',async()=>{
    pacingRedis={status:'reconnecting',eval:async()=>{throw Error('Must not queue');}};
    const engine=new (load('engines/evolution-go/EvolutionGoEngine.ts').EvolutionGoEngine)();
    await assert.rejects(()=>engine.applyAntiBanPacing(instance),/not ready/);
    pacingRedis.status='ready';pacingRedis.eval=async()=>{throw Error('simulated connection failure');};
    await assert.rejects(()=>engine.applyAntiBanPacing(instance),/simulated/);
  });
  await test('pacing reserves a slot atomically and rejects an excessive backlog',async()=>{
    let calls=0;pacingRedis.status='ready';pacingRedis.eval=async(script)=>{assert.ok(script.includes("redis.call('TIME')"));calls++;return 0;};
    const engine=new (load('engines/evolution-go/EvolutionGoEngine.ts').EvolutionGoEngine)();
    await engine.applyAntiBanPacing(instance);assert.equal(calls,1);
    pacingRedis.eval=async()=>-1;await assert.rejects(()=>engine.applyAntiBanPacing(instance),/busy/);
  });
  await test('an engine HTTP 200 with explicit success:false is not ACCEPTED',async()=>{
    const engine=new (load('engines/evolution-go/EvolutionGoEngine.ts').EvolutionGoEngine)();
    engine.getClient=()=>({post:async()=>({status:200,data:{success:false}})});
    engine.resolveInstanceAuth=async()=>({token:'fixture'});engine.applyAntiBanPacing=async()=>{};
    const result=await engine.sendMediaMessage({instanceName:instance,number:'51900000000',media:'JVBERi0=',mediatype:'document',mimetype:'application/pdf'});
    assert.equal(result.success,false);
  });
  await test('explicit instance deletion is not broken by retained delivery metadata',async()=>{
    await request();await pool.query('DELETE FROM instances WHERE id=$1',[instanceId]);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM message_operations')).rows[0].n,0);
  });
  fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({passed:results.length,failed:0,tests:results,
    database:'Isolated PostgreSQL 16 on 127.0.0.1:65429',realMessagesSent:0,productionConnections:0},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());
