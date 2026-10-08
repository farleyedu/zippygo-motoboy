const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(__dirname, '../../assets/sounds');
fs.mkdirSync(out, { recursive: true });
function sound(name, notes) {
  const rate = 22050, duration = notes.length * .21 + .18, samples = Math.ceil(rate * duration);
  const wave = Buffer.alloc(44 + samples * 2);
  wave.write('RIFF'); wave.writeUInt32LE(36 + samples * 2, 4); wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16,16); wave.writeUInt16LE(1,20); wave.writeUInt16LE(1,22);
  wave.writeUInt32LE(rate,24); wave.writeUInt32LE(rate * 2,28); wave.writeUInt16LE(2,32); wave.writeUInt16LE(16,34);
  wave.write('data',36); wave.writeUInt32LE(samples * 2,40);
  for (let i=0;i<samples;i++) {
    const t=i/rate; let value=0;
    notes.forEach((frequency,index)=>{const local=t-index*.21;if(local>=0&&local<.34){const envelope=Math.min(1,local/.015)*Math.exp(-local*12);value+=Math.sin(2*Math.PI*frequency*local)*envelope*.18;}});
    wave.writeInt16LE(Math.round(Math.max(-1,Math.min(1,value))*32767),44+i*2);
  }
  fs.writeFileSync(path.join(out,name),wave);
}
sound('chat-message.wav',[523.25,659.25]);
sound('chat-mention.wav',[659.25,880,1174.66]);
console.log('Dois avisos WAV gerados, com ataques suaves e volume moderado.');
