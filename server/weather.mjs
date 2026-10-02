const cache=new Map();
export async function getWeather(city){
  if(typeof city!=='string'||city.trim().length<2||city.length>80)throw Object.assign(Error('Bir şehir adı gir.'),{status:400});
  const key=city.trim().toLocaleLowerCase('tr'),cached=cache.get(key);if(cached&&cached.until>Date.now())return cached.data;
  const geo=await fetch('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:city,count:'1',language:'tr',format:'json'}),{signal:AbortSignal.timeout(10000)});
  if(!geo.ok)throw Object.assign(Error('Şehir servisine ulaşılamadı.'),{status:502});
  const location=(await geo.json()).results?.[0];if(!location)throw Object.assign(Error('Şehir bulunamadı.'),{status:404});
  const weather=await fetch('https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:location.latitude,longitude:location.longitude,current:'temperature_2m,weather_code',timezone:'auto'}),{signal:AbortSignal.timeout(10000)});
  if(!weather.ok)throw Object.assign(Error('Hava durumu alınamadı.'),{status:502});
  const current=(await weather.json()).current;if(!Number.isFinite(current?.temperature_2m))throw Object.assign(Error('Hava durumu verisi geçersiz.'),{status:502});
  const code=current.weather_code,summary=code===0?'Açık':code<=3?'Bulutlu':code<=48?'Sisli':code<=67?'Yağmurlu':code<=77?'Karlı':code<=82?'Sağanak':code<=86?'Kar yağışı':'Fırtınalı';
  const data={city:String(location.name).slice(0,80),temperature:current.temperature_2m,summary};if(cache.size>200)cache.delete(cache.keys().next().value);cache.set(key,{until:Date.now()+1800000,data});return data;
}
