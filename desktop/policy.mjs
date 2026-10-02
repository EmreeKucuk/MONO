export function appOrigin(input){
  const url=new URL(input);
  if(url.username||url.password||!(url.protocol==='https:'||url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw Error('MONO adresi HTTPS veya yerel 127.0.0.1 olmalı.');
  return url.origin;
}
export function validPolicy(value){
  return {active:value?.active===true,until:Number.isFinite(value?.until)&&value.until>0?Math.min(value.until,Date.now()+86400000):0,allowed:Array.isArray(value?.allowed)?value.allowed.filter(item=>['reminder','focus','zone'].includes(item)):[]};
}
export function canNotify(policy,category,now=Date.now()){
  return !policy?.active||(policy.until>0&&policy.until<=now)||policy.allowed.includes(category);
}
export function validReminders(input){
  if(!Array.isArray(input)||input.length>2000)throw Error('Hatırlatma listesi geçersiz.');
  return input.filter(item=>typeof item?.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(item.id)&&Number.isFinite(item.at)&&item.at>0&&item.at<1e15).map(item=>({id:item.id,at:item.at,text:String(item.text||'').slice(0,300)}));
}
