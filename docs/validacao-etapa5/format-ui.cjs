const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),{spawnSync}=require('node:child_process');
const files=['src/chat/CommunicationScreen.tsx','src/chat/ClientConversation.tsx','src/chat/ChatMedia.tsx','src/chat/ChatNotices.tsx'];
for(const file of files){const absolute=path.resolve(__dirname,'../..',file),source=fs.readFileSync(absolute,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),ranges=[];
function visit(node){if(ts.isJsxText(node)){const value=source.slice(node.pos,node.end);if(!value.trim()&&!value.includes('\n'))ranges.push([node.pos,node.end]);}ts.forEachChild(node,visit);}visit(ast);
let output=source;for(const[start,end]of ranges.sort((a,b)=>b[0]-a[0]))output=output.slice(0,start)+output.slice(end);fs.writeFileSync(absolute,output);}
const prettier=path.join(process.env.LOCALAPPDATA,'npm-cache/_npx/b388654678d519d9/node_modules/prettier/bin/prettier.cjs');
const all=[...files,'src/chat/outbox.ts','src/chat/useChatOutbox.ts','src/chat/noticeRules.ts','src/chat/media.ts','src/chat/push.ts','src/chat/storage.ts','services/communicationApi.ts','services/chatEvents.ts'].map(f=>path.resolve(__dirname,'../..',f));
const result=spawnSync(process.execPath,[prettier,'--write','--single-quote',...all],{stdio:'inherit'});process.exitCode=result.status;
