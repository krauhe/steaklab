// Run explicitly; never part of the build. Uses existing ElevenLabs credits.
import {readFile,writeFile,access} from 'node:fs/promises';
const root=new URL('../assets/voice/en/',import.meta.url);
const key=process.env.ELEVENLABS_API_KEY;
if(!key)throw new Error('Set ELEVENLABS_API_KEY locally; never put it in source files.');
const voice=process.env.ELEVENLABS_VOICE_ID||'JBFqnCBsd6RMkjVDRZzb';
const phrases=JSON.parse(await readFile(new URL('phrases.json',root),'utf8'));
for(const [id,text] of Object.entries(phrases)){
 const destination=new URL(id+'.mp3',root);
 try{await access(destination);console.log('Already saved: '+id);continue;}catch{}
 const response=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voice)+'?output_format=mp3_44100_128',{
  method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},
  body:JSON.stringify({text,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.55,similarity_boost:0.75}}),signal:AbortSignal.timeout(90000)
 });
 if(!response.ok){let status='';try{status=(await response.json()).detail?.status||'';}catch{}throw new Error('ElevenLabs HTTP '+response.status+' '+status+'; stopped without retry.');}
 if(!(response.headers.get('content-type')||'').startsWith('audio/'))throw new Error('Unexpected non-audio response; stopped.');
 await writeFile(destination,Buffer.from(await response.arrayBuffer()));console.log('Saved: '+id);
}
