export type CompletionStorage = { getItemAsync(key:string):Promise<string|null>; setItemAsync(key:string,value:string):Promise<void>; deleteItemAsync(key:string):Promise<void> };
type Pointer = { format:2; revision:string; count:number };
function pointer(raw:string|null):Pointer|null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<Pointer>;
  if (parsed.format !== 2) return null;
  if (typeof parsed.revision !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(parsed.revision) || !Number.isInteger(parsed.count) || parsed.count! < 1 || parsed.count! > 512) throw new Error('Registro de conclusão incompleto.');
  return parsed as Pointer;
}
const chunkKey = (key:string,p:Pointer,i:number) => `${key}.v2.${p.revision}.${i}`;
async function clean(storage:CompletionStorage,key:string,p:Pointer) {
  for(let i=0;i<p.count;i++) await storage.deleteItemAsync(chunkKey(key,p,i));
}
export async function readCompletionRecord(storage:CompletionStorage,key:string):Promise<string|null> {
  const raw = await storage.getItemAsync(key), p = pointer(raw);
  if (!p) return raw; // Migração compatível com o rascunho antigo.
  let json = '';
  for(let i=0;i<p.count;i++) {
    const value = await storage.getItemAsync(chunkKey(key,p,i));
    if(value == null) throw new Error('Registro de conclusão incompleto.');
    json += value;
  }
  return json;
}
export async function writeCompletionRecord(storage:CompletionStorage,key:string,json:string,revision:string):Promise<void> {
  // Até 450 unidades UTF-16 por item; não corta pares de surrogate nem supera 1800 bytes UTF-8.
  const chunks:string[] = []; let part = '';
  for(const char of json) { if(part.length + char.length > 450) { chunks.push(part); part = ''; } part += char; }
  if(part) chunks.push(part);
  const next:Pointer = {format:2,revision,count:chunks.length};
  pointer(JSON.stringify(next));
  const previous = pointer(await storage.getItemAsync(key));
  try {
    for(let i=0;i<chunks.length;i++) await storage.setItemAsync(chunkKey(key,next,i),chunks[i]);
    // O ponteiro só troca após todos os blocos estarem persistidos. Falha antes disso preserva a versão anterior.
    await storage.setItemAsync(key,JSON.stringify(next));
  } catch(error) { await clean(storage,key,next).catch(()=>{}); throw error; }
  if(previous && previous.revision !== next.revision) await clean(storage,key,previous).catch(()=>{});
}
export async function deleteCompletionRecord(storage:CompletionStorage,key:string):Promise<void> {
  const previous = pointer(await storage.getItemAsync(key));
  await storage.deleteItemAsync(key);
  if(previous) await clean(storage,key,previous).catch(()=>{});
}
