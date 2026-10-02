// Rasterize the existing MONO favicon geometry; no extra runtime dependency.
import {writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
const size=256,polygon=[[15,45],[15,19],[23,19],[32,33],[41,19],[49,19],[49,45],[41,45],[41,32],[32,45],[23,32],[23,45]];
function inside(x,y){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
const pixels=Buffer.alloc(size*(size*4+1));
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const fx=(x+.5)/4,fy=(y+.5)/4,dx=Math.max(15-fx,fx-49,0),dy=Math.max(15-fy,fy-49,0),offset=y*(size*4+1)+1+x*4;
  if(dx*dx+dy*dy>225)continue;const color=inside(fx,fy)?[23,32,19]:[180,232,137];pixels.set([...color,255],offset);
}
function crc(bytes){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=value&1?(value>>>1)^0xedb88320:value>>>1;}return (value^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),header=Buffer.alloc(4),checksum=Buffer.alloc(4);header.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([header,type,data,checksum]);}
const dimensions=Buffer.alloc(13);dimensions.writeUInt32BE(size);dimensions.writeUInt32BE(size,4);dimensions[8]=8;dimensions[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',dimensions),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
await writeFile('desktop/icon.png',png);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);await writeFile('desktop/icon.ico',Buffer.concat([ico,png]));
