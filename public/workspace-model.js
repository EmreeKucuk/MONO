import { uid } from './ui-utils.js';
export function initial(demo=true){
  return {
    widgets:[{
      id:uid(),type:'tasks',title:'Bugünün planı',x:0,y:0,width:360,tasks:demo?[{
        id:uid(),text:'Güne bir planla başla',done:true
      },{
        id:uid(),text:'Haftalık öncelikleri belirle',done:false
      },{
        id:uid(),text:'Yarım kalan projeye devam et',done:false
      },{
        id:uid(),text:'Kısa bir yürüyüşe çık',done:false
      }]:[]
    },{
      id:uid(),type:'calendar',title:'Takvim',x:384,y:0,width:320
    },{
      id:uid(),type:'note',title:'Notlar',x:innerWidth>=1350?728:0,y:innerWidth>=1350?0:470,width:320,text:demo?'Daha az şey, daha fazla odak.\n\nBu hafta gerçekten bitirmek istediğim üç şey ne?\n\nBir düşünceyi kaybetmeden buraya bırak.':''
    },{
      id:uid(),type:'focus',title:'Odak zamanı',x:innerWidth>=1350?728:384,y:innerWidth>=1350?440:520,width:320,remaining:1500,running:false,endAt:null
    },{
      id:uid(),type:'habits',title:'Küçük rutinler',x:0,y:510,width:360,habits:demo?[{
        id:uid(),name:'20 dakika oku',days:[]
      },{
        id:uid(),name:'Hareket et',days:[]
      }]:[]
    },{
      id:uid(),type:'links',title:'Elimin altında',x:384,y:550,width:320,links:[]
    }],events:[]
  };
}
