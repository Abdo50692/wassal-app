import { useState, useRef, useEffect, useCallback } from "react";

// ══════════════════════════════════════════════
//  🔧 CONFIG
// ══════════════════════════════════════════════
const SUPABASE_URL = "https://iwivofotgjianvthgntm.supabase.co";
const SUPABASE_KEY = "sb_publishable_WLNGtMZR3yXbDrd3vFwMkQ_VWa4J2Ln";
const ADMIN_PIN    = "1234";

const SHIPMENT_TYPES = ["ملابس","لحوم ومواد غذائية","شحنات من مناطق أخرى","طرود عامة","وثائق","مطعم","أخرى"];
const TYPE_ICON = {"ملابس":"👕","لحوم ومواد غذائية":"🥩","شحنات من مناطق أخرى":"🚛","طرود عامة":"📦","وثائق":"📄","مطعم":"🍔","أخرى":"🔄"};
const DEFAULT_PRICING = [
  {area:"طرابلس",price:15,time:"2-4 ساعة"},
  {area:"مصراتة",price:25,time:"يوم"},
  {area:"بنغازي",price:35,time:"2-3 أيام"},
  {area:"الزاوية",price:20,time:"3-5 ساعات"},
];
const TEAM = [
  {name:"أحمد",phone:"218911111111",role:"مدير"},
  {name:"محمد",phone:"218922222222",role:"مندوب"},
  {name:"خالد",phone:"218933333333",role:"مندوب"},
];
const STATUS_CONFIG = {
  "جديد":            {color:"#6366F1",bg:"#EEF2FF",dot:"#818CF8"},
  "عاجل":            {color:"#DC2626",bg:"#FEF2F2",dot:"#F87171"},
  "قيد التوصيل":     {color:"#F59E0B",bg:"#FFFBEB",dot:"#FCD34D"},
  "قريب من التسليم": {color:"#8B5CF6",bg:"#F5F3FF",dot:"#A78BFA"},
  "متأخر":           {color:"#EF4444",bg:"#FEF2F2",dot:"#FCA5A5"},
  "مكتمل":           {color:"#10B981",bg:"#ECFDF5",dot:"#34D399"},
  "ملغي":            {color:"#6B7280",bg:"#F9FAFB",dot:"#9CA3AF"},
  "يحتاج مراجعة":    {color:"#F97316",bg:"#FFF7ED",dot:"#FB923C"},
};

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
const genId     = () => "W-" + Date.now().toString().slice(-6);
const nowTime   = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const todayDate = () => new Date().toISOString().split("T")[0];
const fmtDate   = d => d ? new Date(d).toLocaleDateString("ar-LY",{day:"2-digit",month:"short"}) : "-";
const buildWA   = (phone,msg) => `https://wa.me/${phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
const calcDiscount = (price, discount) => discount>0 ? Math.round(price*(1-discount/100)) : price;

const groupMsgWA = (o, cn) =>
`🚀 *${cn}* — طلب جديد!
━━━━━━━━━━━━━━━
🆔 ${o.id}
👤 ${o.customer_name||"—"} | 📞 ${o.clientPhone||"—"}
📦 ${o.sender} → 🏠 ${o.destination}
🎁 ${o.package_type}
💰 ${o.finalPrice||o.price} د.ل${o.discount>0?` (خصم ${o.discount}%)`:""}
🕐 ${o.time}
━━━━━━━━━━━━━━━
ردوا بـ: *عندي* 🚗`;

const statusMsgWA = (o, st, dn, dp) => {
  if(st==="قيد التوصيل") return `🚀 *وصّل*\nطلبك #${o.id} مع المندوب *${dn}*\n📞 ${dp}\nسيصلك قريباً ✅`;
  if(st==="قريب من التسليم") return `🚀 *وصّل*\nطلبك #${o.id} على وصول! 🏃`;
  if(st==="مكتمل") return `🚀 *وصّل*\n✅ تم توصيل طلبك #${o.id}!\nشكراً لثقتكم 🙏`;
  return "";
};

// ══════════════════════════════════════════════
//  SUPABASE
// ══════════════════════════════════════════════
const sbH = {
  "Content-Type":"application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer": "return=representation"
};

const fromDB = o => ({
  id:o.order_id, customer_name:o.customer_name, clientPhone:o.client_phone,
  sender:o.sender, package_type:o.package_type, details:o.details,
  destination:o.destination, price:o.price||0, discount:o.discount||0,
  finalPrice:o.final_price||o.price||0,
  status:o.status||"جديد", driver:o.driver_name||null,
  date:o.date, time:o.time, source:o.source||"bot",
  needs_review:o.needs_manual_review||false, raw_message:o.raw_message||null,
});

const toDB = o => ({
  order_id:o.id, customer_name:o.customer_name||null,
  client_phone:o.clientPhone||null, sender:o.sender,
  package_type:o.package_type, details:o.details,
  destination:o.destination, price:o.price||0,
  discount:o.discount||0, final_price:o.finalPrice||o.price||0,
  status:o.status||"جديد", driver_name:o.driver||null,
  date:o.date, time:o.time, source:o.source||"bot",
  needs_manual_review:o.needs_review||false, raw_message:o.raw_message||null,
});

const db = {
  getOrders: async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`,{headers:sbH});
      const d = await r.json();
      return Array.isArray(d) ? d.map(fromDB) : [];
    } catch { return []; }
  },
  insertOrder: async (o) => {
    try { const r=await fetch(`${SUPABASE_URL}/rest/v1/orders`,{method:"POST",headers:sbH,body:JSON.stringify(toDB(o))}); return r.ok; }
    catch { return false; }
  },
  updateOrder: async (id, fields) => {
    try {
      const dbF={};
      if(fields.status!==undefined) dbF.status=fields.status;
      if(fields.driver!==undefined) dbF.driver_name=fields.driver;
      if(fields.price!==undefined)  dbF.price=fields.price;
      if(fields.discount!==undefined){ dbF.discount=fields.discount; dbF.final_price=calcDiscount(fields._price||0,fields.discount); }
      await fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:sbH,body:JSON.stringify(dbF)});
    } catch {}
  },
};

const settingsDB = {
  load: async () => {
    try {
      const r=await fetch(`${SUPABASE_URL}/rest/v1/settings?select=*`,{headers:sbH});
      const d=await r.json();
      if(!Array.isArray(d)) return null;
      const s={};
      d.forEach(row=>{s[row.key]=row.value;});
      if(s.__pin) window.__WASSAL_PIN=s.__pin;
      if(s.__team){try{const t=JSON.parse(s.__team);TEAM.length=0;t.forEach(m=>TEAM.push(m));}catch{}}
      return s;
    } catch { return null; }
  },
  saveAll: async (obj) => {
    try {
      const rows=Object.entries(obj).map(([key,value])=>({key,value:String(value||""),updated_at:new Date().toISOString()}));
      await fetch(`${SUPABASE_URL}/rest/v1/settings`,{method:"POST",headers:{...sbH,"Prefer":"resolution=merge-duplicates"},body:JSON.stringify(rows)});
    } catch {}
  },
};

// ══════════════════════════════════════════════
//  BOT API
// ══════════════════════════════════════════════
async function sendBotMessage(message, phone, companyName) {
  try {
    const r=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,phone,companyName})});
    return await r.json();
  } catch { return {reply:"تم استلام رسالتك ✅ سيتواصل معك فريقنا قريباً.",order_saved:false}; }
}

// تيليغرام
async function sendTelegram(token, chatId, text) {
  if(!token||!chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({chat_id:chatId,text,parse_mode:"Markdown"})
    });
  } catch {}
}

// ══════════════════════════════════════════════
//  EXPORT WORD
// ══════════════════════════════════════════════
function exportReport(orders, driverComm=0.7) {
  const done=orders.filter(o=>o.status==="مكتمل");
  const total=done.reduce((s,o)=>s+Number(o.finalPrice||o.price),0);
  const today=new Date().toLocaleDateString("ar-LY",{day:"2-digit",month:"long",year:"numeric"});
  const dStats={};
  done.forEach(o=>{if(o.driver){dStats[o.driver]=dStats[o.driver]||{n:0,rev:0};dStats[o.driver].n++;dStats[o.driver].rev+=Number(o.finalPrice||o.price);}});
  const review=orders.filter(o=>o.needs_review||o.status==="يحتاج مراجعة");
  const discounted=orders.filter(o=>o.discount>0);

  const html=`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<style>body{font-family:Arial;direction:rtl;margin:32px;color:#1e293b;font-size:13px}
.hdr{text-align:center;padding-bottom:16px;margin-bottom:24px;border-bottom:3px solid #6366F1}
.hdr h1{color:#6366F1;font-size:24px;margin:6px 0 3px}
.cards{display:flex;gap:10px;margin-bottom:22px;flex-wrap:wrap}
.card{flex:1;min-width:100px;background:#F8FAFF;border:1px solid #E0E7FF;border-radius:8px;padding:12px;text-align:center}
.cv{font-size:20px;font-weight:800;color:#6366F1}.cl{font-size:11px;color:#64748b;margin-top:2px}
h2{color:#374151;font-size:15px;margin:20px 0 8px;border-right:4px solid #6366F1;padding-right:10px}
table{width:100%;border-collapse:collapse;margin-bottom:18px}
th{background:#6366F1;color:#fff;padding:8px 10px;text-align:right;font-size:12px}
td{padding:7px 10px;border-bottom:1px solid #E2E8F0;font-size:12px}
tr:nth-child(even) td{background:#F8FAFF}
.tot td{background:#EEF2FF;font-weight:800}
.review td{background:#FFF7ED;color:#C2410C}
.disc td{background:#F0FDF4;color:#166534}
</style></head><body>
<div class="hdr"><div style="font-size:30px">🚀</div><h1>وصّل</h1><p>تقرير المبيعات — ${today}</p></div>
<div class="cards">
  <div class="card"><div class="cv">${orders.length}</div><div class="cl">إجمالي الطلبات</div></div>
  <div class="card"><div class="cv">${done.length}</div><div class="cl">مكتملة</div></div>
  <div class="card"><div class="cv">${total} د.ل</div><div class="cl">الإيرادات</div></div>
  <div class="card"><div class="cv">${Math.round(total*(1-driverComm))} د.ل</div><div class="cl">حصة الشركة</div></div>
  <div class="card"><div class="cv">${discounted.length}</div><div class="cl">طلبات مخفضة</div></div>
  <div class="card"><div class="cv">${review.length}</div><div class="cl">تحتاج مراجعة</div></div>
</div>
<h2>📋 الطلبات المكتملة</h2>
<table><tr><th>#</th><th>رقم الطلب</th><th>الزبون</th><th>المرسل</th><th>التوصيل</th><th>المندوب</th><th>التاريخ</th><th>السعر</th><th>الخصم</th><th>بعد الخصم</th></tr>
${done.map((o,i)=>`<tr><td>${i+1}</td><td>${o.id}</td><td>${o.customer_name||"—"}</td><td>${o.sender}</td><td>${o.destination}</td><td>${o.driver||"—"}</td><td>${fmtDate(o.date)} ${o.time}</td><td>${o.price} د.ل</td><td style="color:#DC2626">${o.discount||0}%</td><td><b>${o.finalPrice||o.price} د.ل</b></td></tr>`).join("")}
<tr class="tot"><td colspan="9">💰 المجموع</td><td>${total} د.ل</td></tr></table>
<h2>🧑‍💼 أداء الفريق</h2>
<table><tr><th>الاسم</th><th>الطلبات</th><th>الإيرادات</th><th>حصته</th></tr>
${Object.entries(dStats).map(([d,v])=>`<tr><td>${d}</td><td>${v.n}</td><td>${v.rev} د.ل</td><td style="color:#10B981;font-weight:800">${Math.round(v.rev*driverComm)} د.ل</td></tr>`).join("")||"<tr><td colspan='4' style='text-align:center;color:#94a3b8'>لا توجد بيانات</td></tr>"}
</table>
${review.length>0?`<h2>⚠️ تحتاج مراجعة</h2><table><tr><th>#</th><th>رقم الطلب</th><th>التفاصيل</th><th>الوقت</th></tr>${review.map((o,i)=>`<tr class="review"><td>${i+1}</td><td>${o.id}</td><td>${o.raw_message||o.details||"—"}</td><td>${fmtDate(o.date)} ${o.time}</td></tr>`).join("")}</table>`:""}
</body></html>`;

  const blob=new Blob([html],{type:"application/msword;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`تقرير-وصّل-${todayDate()}.doc`; a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════
//  BARCODE (بسيط بدون مكتبة خارجية)
// ══════════════════════════════════════════════
function SimpleBarcode({value, width=200, height=50}) {
  const canvasRef = useRef(null);
  useEffect(()=>{
    if(!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,width,height);
    ctx.fillStyle = "#000";
    let x = 10;
    for(let i=0;i<value.length;i++){
      const code = value.charCodeAt(i);
      for(let b=0;b<8;b++){
        const bit = (code>>b)&1;
        if(bit){ ctx.fillRect(x,5,2,height-15); }
        x+=2;
      }
      x+=2;
    }
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(value, width/2, height-2);
  },[value]);
  return <canvas ref={canvasRef} width={width} height={height} style={{display:"block",margin:"0 auto"}}/>;
}

// ══════════════════════════════════════════════
//  ATOMS
// ══════════════════════════════════════════════
const Toast = ({msg,color}) => (
  <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:color||"#10B981",color:"#fff",padding:"11px 24px",borderRadius:12,zIndex:9999,fontWeight:700,fontSize:14,boxShadow:"0 8px 24px #0004",pointerEvents:"none",maxWidth:"90vw",textAlign:"center",fontFamily:"inherit"}}>
    {msg}
  </div>
);

const Badge = ({status}) => {
  const s=STATUS_CONFIG[status]||{color:"#64748b",bg:"#F1F5F9",dot:"#94A3B8"};
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,color:s.color,background:s.bg,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,border:`1px solid ${s.color}33`,whiteSpace:"nowrap"}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:s.dot}}/>
      {status}
    </span>
  );
};

// ══════════════════════════════════════════════
//  🗺️ خريطة التوصيل
// ══════════════════════════════════════════════
function DriverMap({order, onClose}) {
  const mapRef=useRef(null);
  const mapInst=useRef(null);
  useEffect(()=>{
    if(mapInst.current) return;
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload=()=>{
      const lnk=document.createElement("link");
      lnk.rel="stylesheet"; lnk.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(lnk);
      setTimeout(()=>{
        const L=window.L;
        const map=L.map(mapRef.current,{center:[32.87,13.19],zoom:12,zoomControl:false});
        L.control.zoom({position:"bottomleft"}).addTo(map);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
        mapInst.current=map;
        const mkI=(color,emoji,s=36)=>L.divIcon({html:`<div style="background:${color};width:${s}px;height:${s}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${s*.44}px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)">${emoji}</div>`,className:"",iconSize:[s,s],iconAnchor:[s/2,s/2]});
        const fromP=[32.8952,13.2047], toP=[32.8401,13.1813];
        L.marker(fromP,{icon:mkI("#4f8ef7","📦",32)}).addTo(map).bindPopup(`📦 ${order?.sender||"الاستلام"}`).openPopup();
        L.marker(toP,{icon:mkI("#ff5252","🏁",32)}).addTo(map).bindPopup(`🏁 ${order?.destination||"التوصيل"}`);
        fetch(`https://router.project-osrm.org/route/v1/driving/${fromP[1]},${fromP[0]};${toP[1]},${toP[0]}?overview=full&geometries=geojson`)
          .then(r=>r.json()).then(d=>{if(d.code==="Ok"){L.geoJSON(d.routes[0].geometry,{style:{color:"#4f8ef7",weight:5,opacity:.85}}).addTo(map);map.fitBounds(L.geoJSON(d.routes[0].geometry).getBounds(),{padding:[30,30]});}})
          .catch(()=>{L.polyline([fromP,toP],{color:"#4f8ef7",weight:4,dashArray:"8,5"}).addTo(map);});
      },300);
    };
    document.head.appendChild(s);
  },[]);
  return(
    <div style={{position:"fixed",inset:0,background:"#000b",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:800}}>
      <div style={{width:"100%",maxWidth:580,background:"#1E293B",borderRadius:"18px 18px 0 0",overflow:"hidden",direction:"rtl"}}>
        <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #334155"}}>
          <div style={{color:"#E2E8F0",fontWeight:800}}>🗺️ {order?.sender} ← {order?.destination}</div>
          <button onClick={onClose} style={{background:"#334155",border:"none",borderRadius:8,width:30,height:30,color:"#94A3B8",cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        <div ref={mapRef} style={{height:320,width:"100%"}}/>
        <div style={{padding:12,display:"flex",gap:8}}>
          <a href={`https://www.google.com/maps/dir/${order?.sender||""} طرابلس/${order?.destination||""} طرابلس`} target="_blank" rel="noreferrer"
            style={{flex:1,background:"#4f8ef7",color:"#fff",borderRadius:9,padding:"10px",fontSize:13,fontWeight:700,textDecoration:"none",textAlign:"center"}}>
            🧭 Google Maps
          </a>
          {order?.clientPhone&&<a href={`tel:${order.clientPhone}`} style={{background:"#334155",border:"1px solid #475569",color:"#94A3B8",borderRadius:9,padding:"10px 14px",fontSize:14,textDecoration:"none"}}>📞</a>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  🖨️ ملصق الشحنة مع باركود
// ══════════════════════════════════════════════
function ShippingLabel({order, onClose}) {
  return(
    <div style={{position:"fixed",inset:0,background:"#000b",display:"flex",alignItems:"center",justifyContent:"center",zIndex:700,padding:16}}>
      <div style={{background:"#fff",borderRadius:16,padding:20,width:"100%",maxWidth:360,direction:"rtl",fontFamily:"'Courier New',monospace",boxShadow:"0 20px 60px #0006",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:800}}>🖨️ ملصق الشحنة</h3>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>window.print()} style={{background:"#6366F1",color:"#fff",border:"none",borderRadius:7,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>طباعة</button>
            <button onClick={onClose} style={{background:"#F1F5F9",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer"}}>✕</button>
          </div>
        </div>
        <div style={{border:"2px dashed #6366F1",borderRadius:12,padding:14}}>
          <div style={{textAlign:"center",marginBottom:10}}>
            <div style={{fontSize:24}}>🚀</div>
            <div style={{fontWeight:900,fontSize:16,color:"#6366F1"}}>وصّل</div>
          </div>
          {/* باركود */}
          <div style={{background:"#fff",borderRadius:8,padding:"8px 4px",marginBottom:10,border:"1px solid #E2E8F0"}}>
            <SimpleBarcode value={order.id} width={300} height={50}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12}}>
            <span style={{color:"#64748B"}}>رقم الطلب</span>
            <span style={{fontWeight:800,color:"#6366F1"}}>#{order.id}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:12}}>
            <span style={{color:"#64748B"}}>التاريخ</span>
            <span style={{fontWeight:600}}>{fmtDate(order.date)} {order.time}</span>
          </div>
          {order.customer_name&&(
            <div style={{background:"#F8FAFF",borderRadius:8,padding:9,marginBottom:8}}>
              <div style={{fontSize:10,color:"#64748B",marginBottom:2}}>👤 الزبون</div>
              <div style={{fontWeight:800,fontSize:14}}>{order.customer_name}</div>
              {order.clientPhone&&<div style={{fontSize:11,color:"#6366F1"}}>📞 {order.clientPhone}</div>}
            </div>
          )}
          <div style={{background:"#F8FAFF",borderRadius:8,padding:9,marginBottom:8}}>
            <div style={{fontSize:10,color:"#64748B",marginBottom:2}}>📦 من</div>
            <div style={{fontWeight:700,fontSize:13}}>{order.sender}</div>
          </div>
          <div style={{background:"#F0FDF4",borderRadius:8,padding:9,marginBottom:8}}>
            <div style={{fontSize:10,color:"#64748B",marginBottom:2}}>🏠 إلى</div>
            <div style={{fontWeight:700,fontSize:13}}>{order.destination}</div>
          </div>
          <div style={{background:"#FFFBEB",borderRadius:8,padding:9,marginBottom:8,fontSize:12}}>
            📝 {order.package_type} — {order.details}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#EEF2FF",borderRadius:8,padding:"9px 12px"}}>
            <span style={{fontSize:12,color:"#6366F1",fontWeight:600}}>💰 التكلفة</span>
            <div style={{textAlign:"left"}}>
              {order.discount>0&&<div style={{fontSize:10,color:"#DC2626",textDecoration:"line-through"}}>{order.price} د.ل</div>}
              <div style={{fontSize:18,fontWeight:900,color:"#6366F1"}}>{order.finalPrice||order.price} د.ل</div>
              {order.discount>0&&<div style={{fontSize:10,color:"#10B981"}}>خصم {order.discount}%</div>}
            </div>
          </div>
          {order.driver&&<div style={{textAlign:"center",marginTop:8,fontSize:11,color:"#64748B"}}>🧑‍💼 {order.driver}</div>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  🤖 BOT واجهة الزبون
// ══════════════════════════════════════════════
function WhatsAppBot({onOrderCreated, settings, onClose, standalone=false}) {
  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [sessionPhone]=useState("web-"+Date.now());
  const bottomRef=useRef();
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,loading]);
  const addMsg=(from,text)=>setMessages(m=>[...m,{id:Date.now()+Math.random(),from,time:nowTime(),text}]);
  useEffect(()=>{
    addMsg("bot",`👋 أهلاً في ${settings?.companyName||"وصّل"}! 🚀\nمن 9 صباحاً لـ 11 ليلاً 📍 طرابلس\n\nشن نقدر نسوولك؟ 😊\n1️⃣ توصيل بضاعة 📦\n2️⃣ طلب مطعم 🍔\n3️⃣ شحن بين المدن 🚚\n4️⃣ تتبع طلبية 🔍`);
  },[]);
  const send=async()=>{
    const msg=input.trim(); if(!msg||loading)return;
    setInput(""); addMsg("user",msg); setLoading(true);
    try {
      const r=await sendBotMessage(msg,sessionPhone,settings?.companyName||"وصّل");
      addMsg("bot",r.reply||"تم استلام رسالتك ✅");
      if(r.order_saved&&r.order_data){
        const o={id:r.order_data.id||genId(),customer_name:r.order_data.customer_name||null,clientPhone:r.order_data.phone||null,sender:r.order_data.sender||"غير محدد",package_type:r.order_data.package_type||"طرود عامة",details:r.order_data.details||msg,destination:r.order_data.destination||"غير محدد",price:r.order_data.price||0,discount:0,finalPrice:r.order_data.price||0,status:"جديد",date:todayDate(),time:nowTime(),driver:null,source:"bot",needs_review:false};
        if(onOrderCreated) await onOrderCreated(o);
        if(settings?.waGroupNumber) setTimeout(()=>window.open(buildWA(settings.waGroupNumber,groupMsgWA(o,settings?.companyName||"وصّل")),"_blank"),800);
      }
    } catch{addMsg("bot","حدث خطأ. حاول مجدداً 🔄");}
    setLoading(false);
  };
  const quickReplies=["عندي توصيلة 📦","طلب مطعم 🍔","تتبع طلبيتي 🔍","تحدث مع الدعم 💬"];
  const wrap=standalone?{minHeight:"100vh",display:"flex",flexDirection:"column",background:"#ECE5DD",direction:"rtl",fontFamily:"'Segoe UI',sans-serif"}:{position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",background:"#000a",padding:12};
  const box=standalone?{width:"100%",flex:1,display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto"}:{width:"100%",maxWidth:420,height:"92vh",maxHeight:720,display:"flex",flexDirection:"column",borderRadius:20,overflow:"hidden",direction:"rtl",fontFamily:"'Segoe UI',sans-serif",boxShadow:"0 24px 64px #000a"};
  return(
    <div style={wrap}>
      <div style={box}>
        <div style={{background:"#075E54",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          {!standalone&&<button onClick={onClose} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.8)",fontSize:20,cursor:"pointer"}}>←</button>}
          <div style={{width:40,height:40,borderRadius:"50%",background:"#25D366",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🚀</div>
          <div style={{flex:1}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:15}}>{settings?.companyName||"وصّل"}</div>
            <div style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>🤖 بوت ذكي — متصل ✅</div>
          </div>
          {!standalone&&<button onClick={onClose} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.6)",fontSize:18,cursor:"pointer"}}>✕</button>}
        </div>
        <div style={{flex:1,overflowY:"auto",background:"#ECE5DD",padding:"10px",display:"flex",flexDirection:"column",gap:6}}>
          {messages.map(m=>(
            <div key={m.id} style={{display:"flex",justifyContent:m.from==="user"?"flex-start":"flex-end"}}>
              <div style={{maxWidth:"80%",background:m.from==="user"?"#fff":"#DCF8C6",borderRadius:m.from==="user"?"14px 14px 14px 3px":"14px 14px 3px 14px",padding:"8px 11px 5px",boxShadow:"0 1px 2px #0002"}}>
                <div style={{fontSize:13,color:"#1a1a1a",whiteSpace:"pre-wrap",lineHeight:1.5}}>{m.text}</div>
                <div style={{fontSize:10,color:"#64748B",marginTop:3,textAlign:"left"}}>{m.time}</div>
              </div>
            </div>
          ))}
          {loading&&(
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <div style={{background:"#DCF8C6",borderRadius:"14px 14px 3px 14px",padding:"10px 14px"}}>
                <div style={{display:"flex",gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#25D366",animation:`bounce 1s ${i*0.2}s infinite`}}/>)}</div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
        {!loading&&messages.length<=2&&(
          <div style={{background:"#ECE5DD",padding:"0 10px 7px",display:"flex",gap:5,overflowX:"auto",flexShrink:0}}>
            {quickReplies.map(q=><button key={q} onClick={()=>setInput(q)} style={{background:"#fff",border:"1px solid #25D36644",borderRadius:18,padding:"5px 11px",fontSize:11,color:"#075E54",cursor:"pointer",whiteSpace:"nowrap",fontWeight:600,flexShrink:0,fontFamily:"inherit"}}>{q}</button>)}
          </div>
        )}
        <div style={{background:"#F0F2F5",padding:"7px 10px",display:"flex",gap:7,alignItems:"center",flexShrink:0}}>
          <div style={{flex:1,background:"#fff",borderRadius:22,padding:"9px 14px",display:"flex"}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="اكتب رسالتك..." disabled={loading} style={{flex:1,border:"none",outline:"none",fontSize:13,fontFamily:"inherit",background:"transparent",direction:"rtl",color:"#1a1a1a"}}/>
          </div>
          <button onClick={send} disabled={!input.trim()||loading} style={{width:44,height:44,borderRadius:"50%",background:input.trim()&&!loading?"#25D366":"#94A3B8",border:"none",color:"#fff",fontSize:18,cursor:input.trim()&&!loading?"pointer":"default",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {loading?"⏳":"➤"}
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════
//  📦 ORDER CARD — تصميم جديد
// ══════════════════════════════════════════════
function OrderCard({order, onUpdate, onPrint, settings, driverComm=0.7}) {
  const [open,setOpen]=useState(false);
  const [showMap,setShowMap]=useState(false);
  const [discountInput,setDiscountInput]=useState(order.discount||0);
  const isReview=order.needs_review||order.status==="يحتاج مراجعة";
  const isUrgent=order.status==="عاجل";
  const finalPrice=calcDiscount(order.price,order.discount||0);
  const driverShare=Math.round(finalPrice*driverComm);

  return(
    <>
      {showMap&&<DriverMap order={order} onClose={()=>setShowMap(false)}/>}
      <div style={{background:"#1E293B",borderRadius:14,marginBottom:8,overflow:"hidden",border:`1.5px solid ${isUrgent?"#DC2626":isReview?"#F97316":open?"#6366F1":"#334155"}`,transition:"border-color .2s"}}>
        {isUrgent&&<div style={{height:3,background:"linear-gradient(90deg,#DC2626,#EF4444)"}}/>}
        {/* HEADER ROW */}
        <div onClick={()=>setOpen(!open)} style={{padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,borderRadius:10,background:"#0F172A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
            {isReview?"⚠️":isUrgent?"🚨":TYPE_ICON[order.package_type]||"📦"}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13,color:"#E2E8F0",display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:120}}>{order.customer_name||order.sender}</span>
              <span style={{color:"#475569",fontSize:11,fontFamily:"monospace"}}>#{order.id}</span>
              {order.discount>0&&<span style={{background:"#DCFCE7",color:"#166534",fontSize:10,padding:"1px 6px",borderRadius:8,fontWeight:700}}>خصم {order.discount}%</span>}
            </div>
            <div style={{color:"#64748B",fontSize:11,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {order.package_type} • {order.destination}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
            <Badge status={order.status}/>
            <span style={{color:"#F59E0B",fontWeight:800,fontSize:13}}>{finalPrice} د.ل</span>
          </div>
          <span style={{color:"#475569",fontSize:11,transform:open?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▼</span>
        </div>

        {/* DETAILS */}
        {open&&(
          <div style={{borderTop:"1px solid #334155",background:"#0F172A",padding:"14px"}}>
            {isReview&&order.raw_message&&(
              <div style={{background:"#431407",borderRadius:8,padding:"10px",marginBottom:12,border:"1px solid #F97316",fontSize:12,color:"#FED7AA"}}>
                ⚠️ <strong style={{color:"#FB923C"}}>رسالة أصلية:</strong> {order.raw_message}
              </div>
            )}

            {/* INFO GRID */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {[
                ["👤 الزبون",order.customer_name||"—"],
                ["📞 الهاتف",order.clientPhone||"—"],
                ["📦 المرسل",order.sender],
                ["🏠 التوصيل",order.destination],
                ["💰 الأصلي",`${order.price} د.ل`],
                ["💚 بعد الخصم",`${finalPrice} د.ل`],
                ["🚗 حصة المندوب",`${driverShare} د.ل`],
                ["🧑‍💼 المندوب",order.driver||"—"],
              ].map(([l,v])=>(
                <div key={l} style={{background:"#1E293B",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{fontSize:10,color:"#64748B",marginBottom:2}}>{l}</div>
                  <div style={{fontSize:12,fontWeight:600,color:l.includes("حصة")||l.includes("بعد")?"#10B981":"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div>
                </div>
              ))}
            </div>

            {order.details&&<div style={{background:"#1E293B",borderRadius:8,padding:"8px 10px",marginBottom:12,fontSize:12,color:"#94A3B8"}}>📝 {order.details}</div>}

            {/* السعر والخصم */}
            {order.status!=="مكتمل"&&order.status!=="ملغي"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,color:"#64748B",marginBottom:4}}>💰 السعر (د.ل)</div>
                  <input type="number" placeholder="السعر" defaultValue={order.price||""}
                    onBlur={e=>e.target.value&&onUpdate(order.id,"price",Number(e.target.value),{_price:Number(e.target.value)})}
                    style={{width:"100%",borderRadius:8,border:"1px solid #334155",padding:"8px 10px",fontSize:13,fontFamily:"inherit",background:"#1E293B",color:"#E2E8F0",outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:"#64748B",marginBottom:4}}>🏷️ الخصم (%)</div>
                  <div style={{display:"flex",gap:5}}>
                    <input type="number" min="0" max="100" placeholder="0" value={discountInput}
                      onChange={e=>setDiscountInput(Number(e.target.value))}
                      onBlur={()=>onUpdate(order.id,"discount",discountInput,{_price:order.price})}
                      style={{width:"100%",borderRadius:8,border:"1px solid #334155",padding:"8px 10px",fontSize:13,fontFamily:"inherit",background:"#1E293B",color:"#10B981",outline:"none",boxSizing:"border-box"}}/>
                  </div>
                </div>
              </div>
            )}

            {/* تحديث الحالة */}
            {order.status!=="مكتمل"&&order.status!=="ملغي"&&(
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"#64748B",marginBottom:6}}>تحديث الحالة:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {[["قيد التوصيل","#F59E0B"],["قريب من التسليم","#8B5CF6"],["متأخر","#EF4444"],["مكتمل","#10B981"],["ملغي","#6B7280"]]
                    .filter(([st])=>st!==order.status)
                    .map(([st,c])=>(
                    <button key={st} onClick={()=>onUpdate(order.id,"status",st)}
                      style={{background:c,color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* تعيين مندوب */}
            {order.status!=="مكتمل"&&order.status!=="ملغي"&&(
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"#64748B",marginBottom:6}}>تعيين مندوب:</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {TEAM.map(m=>(
                    <button key={m.name} onClick={()=>onUpdate(order.id,"driver",m.name)}
                      style={{background:order.driver===m.name?"#6366F1":"#1E293B",color:order.driver===m.name?"#fff":"#94A3B8",border:`1px solid ${order.driver===m.name?"#6366F1":"#334155"}`,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                      🧑‍💼 {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* أزرار العمليات */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button onClick={()=>onPrint(order)} style={{background:"#6366F1",color:"#fff",border:"none",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>🖨️ طباعة</button>
              <button onClick={()=>setShowMap(true)} style={{background:"#4f8ef7",color:"#fff",border:"none",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>🗺️ خريطة</button>
              {order.clientPhone&&order.status!=="جديد"&&(
                <a href={buildWA(order.clientPhone,statusMsgWA(order,order.status,order.driver,TEAM.find(m=>m.name===order.driver)?.phone||""))} target="_blank" rel="noreferrer"
                  style={{background:"#25D366",color:"#fff",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:700,textDecoration:"none"}}>📱 إشعار</a>
              )}
              {order.clientPhone&&<a href={`tel:${order.clientPhone}`} style={{background:"#1E293B",border:"1px solid #334155",color:"#94A3B8",borderRadius:8,padding:"8px 11px",fontSize:13,textDecoration:"none"}}>📞</a>}
            </div>
            {settings?.waGroupNumber&&(
              <div style={{marginTop:8}}>
                <a href={buildWA(settings.waGroupNumber,groupMsgWA(order,settings?.companyName||"وصّل"))} target="_blank" rel="noreferrer"
                  style={{display:"inline-flex",alignItems:"center",gap:5,background:"#064E3B",color:"#4ADE80",border:"1px solid #065F46",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,textDecoration:"none"}}>
                  📢 إرسال للجروب
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════
//  🔐 LOGIN
// ══════════════════════════════════════════════
function AdminLogin({onLogin}) {
  const [pin,setPin]=useState("");
  const [shake,setShake]=useState(false);
  const [tries,setTries]=useState(0);
  const tryLogin=()=>{
    const cp=window.__WASSAL_PIN||ADMIN_PIN;
    if(pin===cp){onLogin();}
    else{setShake(true);setPin("");setTries(t=>t+1);setTimeout(()=>setShake(false),500);}
  };
  const press=v=>{if(v==="⌫")setPin(p=>p.slice(0,-1));else if(v==="✓")tryLogin();else if(pin.length<4)setPin(p=>p+v);};
  useEffect(()=>{if(pin.length===4)tryLogin();},[pin]);
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0F172A,#1E1B4B,#0F172A)",display:"flex",alignItems:"center",justifyContent:"center",direction:"rtl",fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{background:"rgba(255,255,255,0.05)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:24,padding:"40px 32px",width:290,textAlign:"center"}}>
        <div style={{fontSize:44,marginBottom:6}}>🚀</div>
        <h2 style={{color:"#fff",margin:"0 0 3px",fontSize:20,fontWeight:800}}>وصّل</h2>
        <p style={{color:"#94A3B8",fontSize:12,margin:"0 0 24px"}}>أدخل رمز الدخول</p>
        <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:26}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:12,height:12,borderRadius:"50%",background:i<pin.length?"#818CF8":"transparent",border:`2px solid ${i<pin.length?"#818CF8":"#475569"}`,transition:"all .2s"}}/>)}
        </div>
        <div style={{animation:shake?"shake .4s":"none"}}>
          {[["1","2","3"],["4","5","6"],["7","8","9"],["⌫","0","✓"]].map((row,ri)=>(
            <div key={ri} style={{display:"flex",gap:8,justifyContent:"center",marginBottom:8}}>
              {row.map(v=>(
                <button key={v} onClick={()=>press(v)}
                  style={{width:72,height:52,borderRadius:12,border:`1.5px solid ${v==="✓"?"#6366F1":"rgba(255,255,255,0.1)"}`,background:v==="✓"?"#6366F1":"rgba(255,255,255,0.06)",color:v==="✓"?"#fff":"#E2E8F0",fontSize:v==="⌫"||v==="✓"?18:20,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  {v}
                </button>
              ))}
            </div>
          ))}
        </div>
        {tries>0&&<p style={{color:"#F87171",fontSize:12,marginTop:12}}>❌ رمز خاطئ ({tries} محاولة)</p>}
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ⚙️ صفحة الإعدادات الكاملة
// ══════════════════════════════════════════════
function SettingsPage({settings, setSettings, driverComm, setDriverComm, pricing, setPricing, onBack}) {
  const [activeTab, setActiveTab] = useState("company");
  const [localS, setLocalS] = useState({...settings});
  const [localComm, setLocalComm] = useState(driverComm);
  const [localTeam, setLocalTeam] = useState([...TEAM]);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [saved, setSaved] = useState(false);

  const saveAll = async () => {
    setSettings(localS);
    setDriverComm(localComm);
    TEAM.length=0; localTeam.filter(m=>m.name).forEach(m=>TEAM.push(m));
    await settingsDB.saveAll({
      ...localS,
      driverComm: String(localComm),
      __team: JSON.stringify(localTeam.filter(m=>m.name)),
      ...(window.__WASSAL_PIN?{__pin:window.__WASSAL_PIN}:{})
    });
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const changePin = () => {
    if(newPin.length!==4){setPinMsg("❌ الرمز يجب أن يكون 4 أرقام");return;}
    if(newPin!==confirmPin){setPinMsg("❌ الرمزان غير متطابقين");return;}
    window.__WASSAL_PIN=newPin;
    setNewPin(""); setConfirmPin("");
    setPinMsg("✅ تم تغيير الرمز!");
    setTimeout(()=>setPinMsg(""),3000);
  };

  const tabs = [
    {id:"company",icon:"🏢",label:"الشركة"},
    {id:"pricing",icon:"💰",label:"الأسعار"},
    {id:"team",icon:"👥",label:"الفريق"},
    {id:"security",icon:"🔐",label:"الأمان"},
    {id:"integrations",icon:"🔗",label:"التكامل"},
  ];

  const inp = (value, onChange, placeholder="", type="text") => (
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",borderRadius:9,border:"1px solid #334155",padding:"10px 12px",fontSize:13,fontFamily:"inherit",background:"#0F172A",color:"#E2E8F0",outline:"none",boxSizing:"border-box"}}/>
  );

  return(
    <div style={{minHeight:"100vh",background:"#0F172A",direction:"rtl",fontFamily:"'Segoe UI',sans-serif",color:"#E2E8F0"}}>
      {/* TOP BAR */}
      <div style={{background:"#1E293B",borderBottom:"1px solid #334155",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:54,position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"#334155",border:"none",borderRadius:8,padding:"7px 12px",color:"#94A3B8",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>← رجوع</button>
          <span style={{fontWeight:800,fontSize:15}}>⚙️ الإعدادات</span>
        </div>
        <button onClick={saveAll}
          style={{background:saved?"#10B981":"linear-gradient(135deg,#6366F1,#818CF8)",color:"#fff",border:"none",borderRadius:9,padding:"8px 18px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",transition:"background .3s"}}>
          {saved?"✅ تم الحفظ!":"💾 حفظ الكل"}
        </button>
      </div>

      <div style={{display:"flex",maxWidth:860,margin:"0 auto"}}>
        {/* SIDEBAR */}
        <div style={{width:140,flexShrink:0,padding:"12px 0",borderLeft:"1px solid #334155",minHeight:"calc(100vh - 54px)"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"11px 14px",fontSize:13,fontWeight:700,color:activeTab===t.id?"#818CF8":"#64748B",background:activeTab===t.id?"#1E293B":"transparent",border:"none",borderRight:activeTab===t.id?"3px solid #6366F1":"3px solid transparent",cursor:"pointer",fontFamily:"inherit",transition:"all .2s",textAlign:"right"}}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{flex:1,padding:"20px 16px",maxWidth:640}}>

          {/* الشركة */}
          {activeTab==="company"&&(
            <div>
              <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>🏢 بيانات الشركة</div>
              <div style={{fontSize:12,color:"#64748B",marginBottom:20}}>المعلومات الأساسية التي تظهر في البوت والفواتير</div>
              <div style={{display:"grid",gap:14}}>
                {[["اسم الشركة","companyName","وصّل"],["رقم واتساب الجروب","waGroupNumber","218912345678"],["رقم واتساب الإدارة","adminPhone","218911111111"]].map(([lb,k,ph])=>(
                  <div key={k}>
                    <div style={{fontSize:12,color:"#94A3B8",marginBottom:6,fontWeight:600}}>{lb}</div>
                    {inp(localS[k]||"",v=>setLocalS(s=>({...s,[k]:v})),ph)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* الأسعار */}
          {activeTab==="pricing"&&(
            <div>
              <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>💰 الأسعار والمناطق</div>
              <div style={{fontSize:12,color:"#64748B",marginBottom:20}}>أسعار التوصيل لكل منطقة</div>

              {/* نسبة المندوب */}
              <div style={{background:"#1E293B",borderRadius:12,padding:16,marginBottom:16,border:"1px solid #334155"}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>🚗 نسبة المندوب</div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:8}}>
                  <span>حصة المندوب</span><span style={{color:"#10B981",fontWeight:800}}>{Math.round(localComm*100)}%</span>
                </div>
                <input type="range" min="10" max="90" step="5" value={Math.round(localComm*100)} onChange={e=>setLocalComm(Number(e.target.value)/100)} style={{width:"100%",accentColor:"#10B981",marginBottom:8}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:12}}>
                  <span>حصة الشركة</span><span style={{color:"#6366F1",fontWeight:800}}>{100-Math.round(localComm*100)}%</span>
                </div>
                <div style={{background:"#0F172A",borderRadius:8,padding:10,fontSize:12,color:"#64748B"}}>
                  مثال طلب 20 د.ل: المندوب <strong style={{color:"#10B981"}}>{Math.round(20*localComm)} د.ل</strong> • الشركة <strong style={{color:"#6366F1"}}>{Math.round(20*(1-localComm))} د.ل</strong>
                </div>
              </div>

              {/* جدول الأسعار */}
              <div style={{background:"#1E293B",borderRadius:12,padding:16,border:"1px solid #334155"}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>🗺️ جدول المناطق</div>
                {pricing.map((row,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 90px 32px",gap:8,marginBottom:8,alignItems:"center"}}>
                    <input value={row.area} onChange={e=>setPricing(p=>p.map((r,idx)=>idx===i?{...r,area:e.target.value}:r))} placeholder="المنطقة" style={{borderRadius:7,border:"1px solid #334155",padding:"7px 10px",fontSize:12,fontFamily:"inherit",background:"#0F172A",color:"#E2E8F0",outline:"none"}}/>
                    <input type="number" value={row.price} onChange={e=>setPricing(p=>p.map((r,idx)=>idx===i?{...r,price:Number(e.target.value)}:r))} style={{borderRadius:7,border:"1px solid #334155",padding:"7px 8px",fontSize:12,fontFamily:"inherit",background:"#0F172A",color:"#10B981",outline:"none",textAlign:"center"}}/>
                    <input value={row.time} onChange={e=>setPricing(p=>p.map((r,idx)=>idx===i?{...r,time:e.target.value}:r))} placeholder="الوقت" style={{borderRadius:7,border:"1px solid #334155",padding:"7px 8px",fontSize:12,fontFamily:"inherit",background:"#0F172A",color:"#E2E8F0",outline:"none"}}/>
                    <button onClick={()=>setPricing(p=>p.filter((_,idx)=>idx!==i))} style={{background:"transparent",border:"none",color:"#EF4444",cursor:"pointer",fontSize:16}}>🗑️</button>
                  </div>
                ))}
                <button onClick={()=>setPricing(p=>[...p,{area:"",price:15,time:"يوم"}])} style={{width:"100%",background:"transparent",border:"1.5px dashed #334155",borderRadius:8,padding:"8px",color:"#64748B",fontSize:12,fontFamily:"inherit",cursor:"pointer",marginTop:4}}>
                  + إضافة منطقة
                </button>
              </div>
            </div>
          )}

          {/* الفريق */}
          {activeTab==="team"&&(
            <div>
              <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>👥 إدارة الفريق</div>
              <div style={{fontSize:12,color:"#64748B",marginBottom:20}}>أضف وعدّل وأحذف أعضاء الفريق</div>
              <div style={{display:"grid",gap:10}}>
                {localTeam.map((m,i)=>(
                  <div key={i} style={{background:"#1E293B",borderRadius:12,padding:14,border:"1px solid #334155"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                      <div>
                        <div style={{fontSize:11,color:"#64748B",marginBottom:4}}>الاسم</div>
                        {inp(m.name,v=>setLocalTeam(t=>t.map((r,idx)=>idx===i?{...r,name:v}:r)),"الاسم")}
                      </div>
                      <div>
                        <div style={{fontSize:11,color:"#64748B",marginBottom:4}}>الهاتف</div>
                        {inp(m.phone,v=>setLocalTeam(t=>t.map((r,idx)=>idx===i?{...r,phone:v}:r)),"218XXXXXXXXX")}
                      </div>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <select value={m.role} onChange={e=>setLocalTeam(t=>t.map((r,idx)=>idx===i?{...r,role:e.target.value}:r))}
                        style={{borderRadius:8,border:"1px solid #334155",padding:"7px 10px",fontSize:12,fontFamily:"inherit",background:"#0F172A",color:"#E2E8F0",outline:"none"}}>
                        <option>مدير</option><option>مندوب</option><option>محاسب</option>
                      </select>
                      <button onClick={()=>setLocalTeam(t=>t.filter((_,idx)=>idx!==i))} style={{background:"#FEF2F2",border:"1px solid #DC2626",color:"#DC2626",borderRadius:8,padding:"6px 12px",fontSize:12,fontFamily:"inherit",cursor:"pointer",fontWeight:700}}>
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={()=>setLocalTeam(t=>[...t,{name:"",phone:"",role:"مندوب"}])}
                  style={{background:"transparent",border:"1.5px dashed #334155",borderRadius:10,padding:"12px",color:"#64748B",fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>
                  + إضافة عضو جديد
                </button>
              </div>
            </div>
          )}

          {/* الأمان */}
          {activeTab==="security"&&(
            <div>
              <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>🔐 الأمان والخصوصية</div>
              <div style={{fontSize:12,color:"#64748B",marginBottom:20}}>تغيير رمز الدخول</div>
              <div style={{background:"#1E293B",borderRadius:12,padding:16,border:"1px solid #334155"}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>🔑 تغيير رمز الدخول (PIN)</div>
                <div style={{display:"grid",gap:12}}>
                  <div>
                    <div style={{fontSize:12,color:"#94A3B8",marginBottom:6}}>الرمز الجديد (4 أرقام)</div>
                    <input type="password" maxLength={4} value={newPin} onChange={e=>setNewPin(e.target.value.replace(/[^0-9]/g,""))} placeholder="••••"
                      style={{width:"100%",borderRadius:9,border:"1px solid #334155",padding:"10px 12px",fontSize:20,fontFamily:"monospace",background:"#0F172A",color:"#E2E8F0",outline:"none",letterSpacing:8,boxSizing:"border-box"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:12,color:"#94A3B8",marginBottom:6}}>تأكيد الرمز</div>
                    <input type="password" maxLength={4} value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/[^0-9]/g,""))} placeholder="••••"
                      style={{width:"100%",borderRadius:9,border:"1px solid #334155",padding:"10px 12px",fontSize:20,fontFamily:"monospace",background:"#0F172A",color:"#E2E8F0",outline:"none",letterSpacing:8,boxSizing:"border-box"}}/>
                  </div>
                  <button onClick={changePin} style={{background:"#6366F1",color:"#fff",border:"none",borderRadius:9,padding:"11px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                    🔐 تغيير الرمز
                  </button>
                  {pinMsg&&<div style={{fontSize:13,color:pinMsg.includes("✅")?"#10B981":"#EF4444",textAlign:"center",fontWeight:600}}>{pinMsg}</div>}
                </div>
              </div>
            </div>
          )}

          {/* التكامل */}
          {activeTab==="integrations"&&(
            <div>
              <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>🔗 التكامل مع المنصات</div>
              <div style={{fontSize:12,color:"#64748B",marginBottom:20}}>ربط تيليغرام والإشعارات التلقائية</div>
              <div style={{background:"#1E293B",borderRadius:12,padding:16,border:"1px solid #334155",marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>✈️ تيليغرام</div>
                {[["Bot Token","tgToken","123456:ABC..."],["Chat ID","tgChatId","-1001234567890"]].map(([lb,k,ph])=>(
                  <div key={k} style={{marginBottom:12}}>
                    <div style={{fontSize:12,color:"#94A3B8",marginBottom:6}}>{lb}</div>
                    {inp(localS[k]||"",v=>setLocalS(s=>({...s,[k]:v})),ph)}
                  </div>
                ))}
                <div style={{background:"#0F172A",borderRadius:8,padding:10,fontSize:12,color:"#64748B",marginTop:4}}>
                  💡 يُرسل إشعار تلقائي عند تعيين مندوب أو تغيير حالة الطلب
                </div>
              </div>
              <div style={{background:"#1E293B",borderRadius:12,padding:16,border:"1px solid #334155"}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>📱 واتساب</div>
                <div style={{fontSize:12,color:"#64748B"}}>واتساب يعمل عبر روابط wa.me المباشرة — لا يحتاج إعداد إضافي ✅</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  📊 DASHBOARD
// ══════════════════════════════════════════════
function Dashboard({orders,onUpdate,onLogout,settings,onOpenBot,dbStatus,driverComm,pricing,onOpenSettings}) {
  const [tab,setTab]=useState("orders");
  const [filter,setFilter]=useState("الكل");
  const [search,setSearch]=useState("");
  const [dateFilter,setDateFilter]=useState("الكل");
  const [printOrder,setPrintOrder]=useState(null);
  const [exporting,setExporting]=useState(false);
  const [darkMode,setDarkMode]=useState(true);

  const FILTERS=["الكل","عاجل","يحتاج مراجعة","جديد","قيد التوصيل","قريب من التسليم","متأخر","مكتمل","ملغي"];
  const bg=darkMode?"#0F172A":"#F1F5F9";
  const card=darkMode?"#1E293B":"#fff";
  const border=darkMode?"#334155":"#E2E8F0";
  const text=darkMode?"#E2E8F0":"#1a1d2e";
  const muted=darkMode?"#64748B":"#6B7280";

  const dateFiltered = dateFilter==="اليوم"
    ? orders.filter(o=>o.date===todayDate())
    : dateFilter==="الأسبوع"
    ? orders.filter(o=>{ const d=new Date(o.date); const w=new Date(); w.setDate(w.getDate()-7); return d>=w; })
    : orders;

  const filtered = dateFiltered.filter(o=>{
    const mf=filter==="الكل"||o.status===filter||(filter==="يحتاج مراجعة"&&o.needs_review);
    const ms=!search||(o.customer_name||"").includes(search)||o.id.includes(search)||(o.clientPhone||"").includes(search)||o.sender.includes(search)||(o.destination||"").includes(search);
    return mf&&ms;
  }).sort((a,b)=>{
    const p={"عاجل":3,"يحتاج مراجعة":2,"جديد":1};
    return (p[b.status]||0)-(p[a.status]||0)||b.id.localeCompare(a.id);
  });

  const stats={
    total:dateFiltered.length,
    urgent:dateFiltered.filter(o=>o.status==="عاجل").length,
    review:dateFiltered.filter(o=>o.needs_review||o.status==="يحتاج مراجعة").length,
    new:dateFiltered.filter(o=>o.status==="جديد").length,
    active:dateFiltered.filter(o=>["قيد التوصيل","قريب من التسليم"].includes(o.status)).length,
    delayed:dateFiltered.filter(o=>o.status==="متأخر").length,
    done:dateFiltered.filter(o=>o.status==="مكتمل").length,
    revenue:dateFiltered.filter(o=>o.status==="مكتمل").reduce((s,o)=>s+Number(o.finalPrice||o.price),0),
    discounted:dateFiltered.filter(o=>o.discount>0).length,
  };

  const driverStats={};
  dateFiltered.filter(o=>o.status==="مكتمل").forEach(o=>{
    if(o.driver){driverStats[o.driver]=driverStats[o.driver]||{n:0,rev:0};driverStats[o.driver].n++;driverStats[o.driver].rev+=Number(o.finalPrice||o.price);}
  });

  const last7 = Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-i);
    const ds=d.toISOString().split("T")[0];
    return {date:d.toLocaleDateString("ar-LY",{day:"2-digit",month:"short"}),count:orders.filter(o=>o.date===ds).length};
  }).reverse();
  const maxC=Math.max(...last7.map(d=>d.count),1);

  return(
    <div style={{direction:"rtl",fontFamily:"'Segoe UI',sans-serif",minHeight:"100vh",background:bg,color:text,transition:"background .3s"}}>
      {printOrder&&<ShippingLabel order={printOrder} onClose={()=>setPrintOrder(null)}/>}

      {/* TOP BAR */}
      <div style={{background:card,borderBottom:`1px solid ${border}`,padding:"0 16px",position:"sticky",top:0,zIndex:50,boxShadow:"0 1px 8px #0002"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>🚀</span>
            <div>
              <div style={{fontWeight:900,fontSize:15}}>{settings.companyName||"وصّل"}</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:dbStatus==="ok"?"#10B981":"#F43F5E",display:"inline-block"}}/>
                <span style={{color:muted,fontSize:10}}>{dbStatus==="ok"?"متصل ✅":"يتصل..."}</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {stats.urgent>0&&(
              <button onClick={()=>setFilter("عاجل")} style={{background:"#FEF2F2",color:"#DC2626",border:"1px solid #DC2626",borderRadius:8,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                🚨 {stats.urgent}
              </button>
            )}
            {stats.review>0&&(
              <button onClick={()=>setFilter("يحتاج مراجعة")} style={{background:"#FFF7ED",color:"#F97316",border:"1px solid #F97316",borderRadius:8,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                ⚠️ {stats.review}
              </button>
            )}
            <button onClick={onOpenBot} style={{background:"#25D366",color:"#fff",border:"none",borderRadius:8,padding:"7px 11px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🤖</button>
            <button onClick={()=>{setExporting(true);exportReport(dateFiltered,driverComm);setTimeout(()=>setExporting(false),1200);}} style={{background:"#10B981",color:"#fff",border:"none",borderRadius:8,padding:"7px 11px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {exporting?"⏳":"📊"}
            </button>
            <button onClick={()=>setDarkMode(!darkMode)} style={{background:border,color:muted,border:"none",borderRadius:8,padding:"7px 10px",fontSize:15,cursor:"pointer"}}>{darkMode?"☀️":"🌙"}</button>
            <button onClick={onOpenSettings} style={{background:border,color:muted,border:"none",borderRadius:8,padding:"7px 10px",fontSize:15,cursor:"pointer"}}>⚙️</button>
            <button onClick={onLogout} style={{background:"transparent",color:muted,border:`1px solid ${border}`,borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>🔒</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:900,margin:"0 auto",padding:"14px"}}>

        {/* فلتر التاريخ */}
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {["الكل","اليوم","الأسبوع"].map(d=>(
            <button key={d} onClick={()=>setDateFilter(d)}
              style={{background:dateFilter===d?"#6366F1":card,color:dateFilter===d?"#fff":muted,border:`1px solid ${dateFilter===d?"#6366F1":border}`,borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {d==="الكل"?"📅 الكل":d==="اليوم"?"🌅 اليوم":"📆 الأسبوع"}
            </button>
          ))}
        </div>

        {/* STATS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
          {[["📋",stats.total,"إجمالي","#6366F1"],["✅",stats.done,"مكتمل","#10B981"],["🚴",stats.active,"جاري","#F59E0B"],["💰",`${stats.revenue}د.ل`,"إيرادات","#34D399"]].map(([ic,val,lb,c])=>(
            <div key={lb} style={{background:card,borderRadius:12,padding:"12px 10px",border:`1px solid ${border}`,borderTop:`3px solid ${c}`,textAlign:"center"}}>
              <div style={{fontSize:16}}>{ic}</div>
              <div style={{fontSize:lb==="إيرادات"?12:18,fontWeight:900,color:c,margin:"3px 0 2px"}}>{val}</div>
              <div style={{fontSize:10,color:muted}}>{lb}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{display:"flex",gap:3,marginBottom:16,background:card,borderRadius:11,padding:4,border:`1px solid ${border}`}}>
          {[["orders","📦 الطلبات"],["stats","📊 إحصائيات"],["team","👥 الفريق"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)}
              style={{flex:1,background:tab===v?"#6366F1":"transparent",color:tab===v?"#fff":muted,border:"none",borderRadius:8,padding:"9px 5px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
              {l}
            </button>
          ))}
        </div>

        {/* ORDERS */}
        {tab==="orders"&&(
          <>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input placeholder="🔍 بحث عن طلب أو زبون..." value={search} onChange={e=>setSearch(e.target.value)}
                style={{flex:1,borderRadius:9,border:`1px solid ${border}`,padding:"10px 13px",fontSize:13,fontFamily:"inherit",background:card,color:text,outline:"none"}}/>
              <button onClick={onOpenBot} style={{background:"#25D366",color:"#fff",border:"none",borderRadius:9,padding:"10px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>🤖 طلب جديد</button>
            </div>
            <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
              {FILTERS.map(f=>{
                const sc=STATUS_CONFIG[f];
                const active=filter===f;
                const cnt=f==="الكل"?dateFiltered.length:f==="يحتاج مراجعة"?stats.review:dateFiltered.filter(o=>o.status===f).length;
                return(
                  <button key={f} onClick={()=>setFilter(f)}
                    style={{background:active?(sc?.color||"#6366F1"):card,color:active?"#fff":muted,border:`1px solid ${active?(sc?.color||"#6366F1"):border}`,borderRadius:18,padding:"5px 11px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                    {f}{cnt>0?` (${cnt})`:""}
                  </button>
                );
              })}
            </div>
            {filtered.length===0
              ?<div style={{textAlign:"center",color:muted,padding:"50px 0"}}><div style={{fontSize:40,marginBottom:10}}>📭</div>لا توجد طلبات</div>
              :filtered.map(o=><OrderCard key={o.id} order={o} onUpdate={onUpdate} onPrint={setPrintOrder} settings={settings} driverComm={driverComm}/>)
            }
          </>
        )}

        {/* STATS */}
        {tab==="stats"&&(
          <div style={{display:"grid",gap:12}}>
            {/* رسم بياني */}
            <div style={{background:card,borderRadius:12,padding:16,border:`1px solid ${border}`}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:14}}>📈 الطلبات آخر 7 أيام</div>
              <div style={{display:"flex",gap:5,alignItems:"flex-end",height:80}}>
                {last7.map((d,i)=>(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{fontSize:10,color:"#6366F1",fontWeight:700}}>{d.count||""}</div>
                    <div style={{width:"100%",background:d.count>0?"#6366F1":border,borderRadius:"3px 3px 0 0",height:`${(d.count/maxC)*60}px`,minHeight:d.count>0?6:2,transition:"height .5s"}}/>
                    <div style={{fontSize:9,color:muted,textAlign:"center"}}>{d.date}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* توزيع الإيرادات */}
            <div style={{background:card,borderRadius:12,padding:16,border:`1px solid ${border}`}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:12}}>💰 توزيع الإيرادات</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[["الإجمالي",stats.revenue,"#34D399"],["المناديب",Math.round(stats.revenue*driverComm),"#10B981"],["الشركة",Math.round(stats.revenue*(1-driverComm)),"#6366F1"]].map(([l,v,c])=>(
                  <div key={l} style={{background:bg,borderRadius:10,padding:12,textAlign:"center",border:`1px solid ${border}`}}>
                    <div style={{fontSize:16,fontWeight:900,color:c}}>{v} <span style={{fontSize:11}}>د.ل</span></div>
                    <div style={{fontSize:11,color:muted,marginTop:3}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* طلبات مخفضة */}
            {stats.discounted>0&&(
              <div style={{background:card,borderRadius:12,padding:14,border:`1px solid ${border}`}}>
                <div style={{fontSize:13,fontWeight:800,marginBottom:8}}>🏷️ التخفيضات</div>
                <div style={{fontSize:13,color:muted}}>{stats.discounted} طلب مخفض من أصل {stats.total} طلب</div>
              </div>
            )}

            {/* 6 مربعات */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[["📋",stats.total,"إجمالي","#6366F1"],["🆕",stats.new,"جديدة","#818CF8"],["🚴",stats.active,"جارية","#F59E0B"],["✅",stats.done,"مكتملة","#10B981"],["🔴",stats.delayed,"متأخرة","#EF4444"],["⚠️",stats.review,"مراجعة","#F97316"]].map(([ic,val,lb,c])=>(
                <div key={lb} style={{background:card,borderRadius:11,padding:"12px 10px",border:`1px solid ${border}`,borderTop:`3px solid ${c}`,textAlign:"center"}}>
                  <div style={{fontSize:16}}>{ic}</div>
                  <div style={{fontSize:18,fontWeight:900,color:c,margin:"3px 0 2px"}}>{val}</div>
                  <div style={{fontSize:10,color:muted}}>{lb}</div>
                </div>
              ))}
            </div>

            {/* جدول الأسعار */}
            <div style={{background:card,borderRadius:12,padding:16,border:`1px solid ${border}`}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:12}}>🗺️ أسعار المناطق</div>
              {pricing.map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<pricing.length-1?`1px solid ${border}`:"none"}}>
                  <span style={{fontSize:13}}>{r.area}</span>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{color:muted,fontSize:12}}>⏱️ {r.time}</span>
                    <span style={{color:"#34D399",fontWeight:800,fontSize:14}}>{r.price} د.ل</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEAM */}
        {tab==="team"&&(
          <div style={{background:card,borderRadius:12,padding:16,border:`1px solid ${border}`}}>
            <div style={{fontSize:13,fontWeight:800,marginBottom:14}}>👥 أداء الفريق</div>
            {TEAM.map(m=>{
              const ds=driverStats[m.name];
              const active=dateFiltered.filter(o=>["قيد التوصيل","قريب من التسليم"].includes(o.status)&&o.driver===m.name).length;
              return(
                <div key={m.name} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 0",borderBottom:`1px solid ${border}`}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:active>0?"linear-gradient(135deg,#F59E0B,#D97706)":"linear-gradient(135deg,#10B981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🧑‍💼</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                      {m.name}
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:active>0?"#FEF3C7":"#DCFCE7",color:active>0?"#D97706":"#16A34A",fontWeight:700}}>
                        {active>0?`${active} جارية 🟡`:"متاح ✅"}
                      </span>
                      <span style={{fontSize:10,color:muted}}>{m.role}</span>
                    </div>
                    <div style={{fontSize:12,color:muted,marginTop:3}}>
                      {ds?`${ds.n} طلب • ${ds.rev} د.ل • حصته ${Math.round(ds.rev*driverComm)} د.ل`:"لا توجد طلبات مكتملة"}
                    </div>
                  </div>
                  <a href={buildWA(m.phone,"")} target="_blank" rel="noreferrer"
                    style={{background:"#25D366",color:"#fff",borderRadius:8,padding:"7px 11px",fontSize:13,fontWeight:700,textDecoration:"none",flexShrink:0}}>📱</a>
                </div>
              );
            })}
            {settings.waGroupNumber&&(
              <div style={{marginTop:14,background:bg,borderRadius:10,padding:"12px 14px",border:`1px solid ${border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{color:"#4ADE80",fontWeight:700,fontSize:13}}>📢 جروب الفريق</div>
                  <div style={{color:muted,fontSize:11,marginTop:2}}>{settings.waGroupNumber}</div>
                </div>
                <a href={buildWA(settings.waGroupNumber,"مرحباً الفريق 👋")} target="_blank" rel="noreferrer"
                  style={{background:"#25D366",color:"#fff",borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:700,textDecoration:"none"}}>📱</a>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════════
export default function App() {
  const isBot = window.location.pathname==="/bot"||new URLSearchParams(window.location.search).get("bot")==="1";
  const [page,       setPage]       = useState(isBot?"bot":"login");
  const [orders,     setOrders]     = useState([]);
  const [settings,   setSettings]   = useState({companyName:"وصّل",waGroupNumber:"",adminPhone:"",tgToken:"",tgChatId:""});
  const [driverComm, setDriverComm] = useState(0.7);
  const [pricing,    setPricing]    = useState(DEFAULT_PRICING);
  const [toast,      setToast]      = useState(null);
  const [showBot,    setShowBot]    = useState(false);
  const [dbStatus,   setDbStatus]   = useState("connecting");
  const [loading,    setLoading]    = useState(!isBot);

  const showToast=(msg,color="#10B981")=>{
    setToast({msg,color});
    try {
      const ctx=new (window.AudioContext||window.webkitAudioContext)();
      const play=(freq,start,dur,vol=0.3)=>{const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(freq,ctx.currentTime+start);g.gain.setValueAtTime(vol,ctx.currentTime+start);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+start+dur);o.start(ctx.currentTime+start);o.stop(ctx.currentTime+start+dur);};
      if(color==="#DC2626"){play(880,0,0.12,0.4);play(880,0.15,0.12,0.4);play(1100,0.30,0.2,0.5);}
      else{play(600,0,0.1,0.25);play(800,0.12,0.15,0.3);}
    } catch {}
    setTimeout(()=>setToast(null),3000);
  };

  useEffect(()=>{
    if(isBot) return;
    const load=async()=>{
      const saved=await settingsDB.load();
      if(saved&&Object.keys(saved).length>0){
        setSettings(prev=>({...prev,...saved}));
        if(saved.driverComm) setDriverComm(Number(saved.driverComm));
      }
      const data=await db.getOrders();
      setOrders(data);
      setDbStatus(data!==null?"ok":"error");
      setLoading(false);
    };
    load();
    const iv=setInterval(async()=>{
      const data=await db.getOrders();
      if(data){
        setOrders(prev=>{
          const newOnes=data.filter(o=>!prev.find(p=>p.id===o.id));
          newOnes.forEach(o=>{
            if(o.status==="عاجل") showToast(`🚨 طلب عاجل من ${o.customer_name||o.sender}!`,"#DC2626");
            else showToast(`🔔 طلب جديد من ${o.customer_name||o.sender}!`,"#6366F1");
          });
          return data;
        });
        setDbStatus("ok");
      }
    },8000);
    return()=>clearInterval(iv);
  },[]);

  const addOrder=useCallback(async(o)=>{
    const saved=await db.insertOrder(o);
    if(saved){setOrders(prev=>[o,...prev]);showToast(o.status==="عاجل"?`🚨 طلب عاجل من ${o.customer_name||o.sender}!`:`✅ طلب جديد من ${o.customer_name||o.sender}!`,o.status==="عاجل"?"#DC2626":"#6366F1");}
    else{setOrders(prev=>[o,...prev]);showToast("⚠️ حُفظ محلياً فقط","#F59E0B");}
  },[]);

  const updateOrder=useCallback(async(id,k,v,extra={})=>{
    await db.updateOrder(id,{[k]:v,...extra});
    setOrders(prev=>{
      const updated=prev.map(o=>o.id===id?{...o,[k]:v,...(k==="discount"?{finalPrice:calcDiscount(o.price,v)}:{})}:o);
      const order=updated.find(o=>o.id===id);
      if(order&&(k==="driver"||k==="status")&&settings.tgToken&&settings.tgChatId){
        const msg=k==="driver"
          ?`🧑‍💼 *تعيين مندوب*\nالطلب: \`${id}\`\nالمندوب: *${v}*\n📦 ${order.package_type||""}\n🏠 ${order.destination||""}`
          :`📦 *تحديث حالة*\nالطلب: \`${id}\`\nالحالة: *${v}*\n👤 ${order.customer_name||order.sender||""}`;
        sendTelegram(settings.tgToken,settings.tgChatId,msg);
      }
      return updated;
    });
    showToast(k==="status"?`📦 "${v}"`:k==="discount"?`🏷️ خصم ${v}%`:`🧑‍💼 تعيين ${v}`);
  },[settings]);

  if(isBot) return(
    <>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      <WhatsAppBot onOrderCreated={addOrder} settings={settings} standalone={true}/>
    </>
  );

  if(loading) return(
    <div style={{minHeight:"100vh",background:"#0F172A",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{fontSize:52}}>🚀</div>
      <div style={{color:"#fff",fontSize:20,fontWeight:900}}>وصّل</div>
      <div style={{color:"#64748B",fontSize:13}}>جاري الاتصال...</div>
      <div style={{width:34,height:34,border:"3px solid #334155",borderTop:"3px solid #6366F1",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {showBot&&<WhatsAppBot onOrderCreated={addOrder} settings={settings} onClose={()=>setShowBot(false)}/>}
      {page==="login"&&<AdminLogin onLogin={()=>setPage("dashboard")}/>}
      {page==="settings"&&(
        <SettingsPage
          settings={settings} setSettings={setSettings}
          driverComm={driverComm} setDriverComm={setDriverComm}
          pricing={pricing} setPricing={setPricing}
          onBack={()=>setPage("dashboard")}/>
      )}
      {page==="dashboard"&&(
        <Dashboard
          orders={orders} onUpdate={updateOrder}
          onLogout={()=>setPage("login")}
          settings={settings}
          onOpenBot={()=>setShowBot(true)}
          dbStatus={dbStatus}
          driverComm={driverComm}
          pricing={pricing}
          onOpenSettings={()=>setPage("settings")}/>
      )}
    </>
  );
}
