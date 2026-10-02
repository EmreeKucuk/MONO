const months=['ocak','şubat','mart','nisan','mayıs','haziran','temmuz','ağustos','eylül','ekim','kasım','aralık'];
const weekdays=['pazar','pazartesi','salı','çarşamba','perşembe','cuma','cumartesi'];
export function parseCapture(input,now=new Date()){
  let text=String(input||'').trim(),day=new Date(now.getFullYear(),now.getMonth(),now.getDate()),found=false,time=null;
  const kind=/hatırlat(?:ma)?/iu.test(text)?'reminder':'event';
  text=text.replace(/hatırlat(?:ma)?/giu,'').trim();
  const relative=text.match(/(\d{1,4})\s*(dakika|saat)\s+sonra/i);
  if(relative){const minutes=Number(relative[1])*(relative[2].toLocaleLowerCase('tr')==='saat'?60:1);if(minutes<1||minutes>10080)throw Error('Süre 1 dakika ile 7 gün arasında olmalı.');const date=new Date(now.getTime()+minutes*60000);if(!text.replace(relative[0],'').trim())throw Error('Bir açıklama yaz.');return {kind:'reminder',text:text.replace(relative[0],'').trim(),at:date.getTime(),date:dateKey(date),time:timeKey(date)};}
  const absolute=text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)||text.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
  if(absolute){const iso=absolute[1].length===4,year=Number(absolute[iso?1:3]),month=Number(absolute[2]),date=Number(absolute[iso?3:1]);day=new Date(year,month-1,date);if(day.getFullYear()!==year||day.getMonth()!==month-1||day.getDate()!==date)throw Error('Tarih geçersiz.');text=text.replace(absolute[0],'');found=true;}
  const named=text.toLocaleLowerCase('tr').match(new RegExp('(\\d{1,2})\\s+('+months.join('|')+')(?:\\s+(\\d{4}))?','u'));
  if(!found&&named){const month=months.indexOf(named[2]),year=Number(named[3])||now.getFullYear(),date=Number(named[1]);day=new Date(year,month,date);if(day.getMonth()!==month||day.getDate()!==date)throw Error('Tarih geçersiz.');if(!named[3]&&day<new Date(now.getFullYear(),now.getMonth(),now.getDate()))day.setFullYear(year+1);text=text.replace(new RegExp(named[0],'iu'),'');found=true;}
  if(!found){
    const lower=text.toLocaleLowerCase('tr');
    if(lower.includes('yarın')){day.setDate(day.getDate()+1);text=text.replace(/yarın/iu,'');found=true;}
    else if(lower.includes('bugün')){text=text.replace(/bugün/iu,'');found=true;}
    else for(const i of [1,6,3,4,2,5,0]){if(new RegExp('(^|[^\\p{L}])'+weekdays[i]+'(?=$|[^\\p{L}])','u').test(lower)){let diff=(i-day.getDay()+7)%7;if(diff===0)diff=7;if(lower.includes('haftaya'))diff=(8-((day.getDay()+6)%7+1))+((i+6)%7);day.setDate(day.getDate()+diff);text=text.replace(new RegExp(weekdays[i],'iu'),'').replace(/haftaya/iu,'');found=true;break;}}
  }
  const clock=text.match(/(?:saat\s*)?\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/iu)||text.match(/saat\s+([01]?\d|2[0-3])\b/iu);
  if(clock){time=String(clock[1]).padStart(2,'0')+':'+String(clock[2]||'00').padStart(2,'0');text=text.replace(clock[0],'');}
  if(!found&&!clock)throw Error('Bir tarih veya gün belirt: yarın 14:30, pazartesi, 05.10.2026 gibi.');
  const at=new Date(day);const [hour,minute]=(time||'09:00').split(':').map(Number);at.setHours(hour,minute,0,0);
  text=text.replace(/\s+/g,' ').trim();if(!text)throw Error('Kaydedilecek bir açıklama yaz.');
  return {kind,text,date:dateKey(day),time,at:at.getTime()};
}
export const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const timeKey=date=>`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
