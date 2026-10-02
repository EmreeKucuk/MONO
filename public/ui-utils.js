export const $=(s)=>document.querySelector(s), uid=()=>crypto.randomUUID(),escape=(s)=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}
[c]));
export const icons={
  spotify:'<circle cx="12" cy="12" r="9"/><path d="M6 9c4-2 8-1 12 1M7 12c3-1 7-1 10 1M8 15c3-1 5-1 8 1"/>',
  goal:'<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-7M20 16V5"/>',dates:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M9 15h6"/>',habits:'<path d="m4 12 5 5L20 5"/><path d="M20 12v8H4V4h10"/>',links:'<path d="M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-3 3M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l3-3"/>',journal:'<path d="M4 3h15v18H4zM8 3v18M11 8h5M11 12h5"/>',board:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',tasks:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/>',note:'<path d="M14 3H5v18h14V8zM14 3v6h5M8 13h8M8 17h6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18M8 15h1M15 15h1"/>',focus:'<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6"/>'
};
export const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.board}</svg>`;
export const dateKey=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
