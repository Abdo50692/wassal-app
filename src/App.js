import { useState, useRef, useEffect, useCallback } from "react";

// ══════════════════════════════════════════════
//  🔧 الإعدادات
// ══════════════════════════════════════════════
const SUPABASE_URL = "https://iwivofotgjianvthgntm.supabase.co";
const SUPABASE_KEY = "sb_publishable_WLNGtMZR3yXbDrd3vFwMkQ_VWa4J2Ln";
const ADMIN_PIN    = "1234";

const SHIPMENT_TYPES = ["ملابس","لحوم ومواد غذائية","شحنات من مناطق أخرى","طرود عامة","وثائق","مطعم","أخرى"];
const TYPE_ICON = {"ملابس":"👕","لحوم ومواد غذائية":"🥩","شحنات من مناطق أخرى":"🚛","طرود عامة":"📦","وثائق":"📄","مطعم":"🍔","أخرى":"🔄"};

const TEAM = [
  {name:"أحمد",   phone:"218911111111", role:"مدير"},
  {name:"محمد",   phone:"218922222222", role:"مندوب"},
  {name:"خالد",   phone:"218933333333", role:"مندوب"},
];

const STATUS_CONFIG = {
  "جديد":              {color:"#6366F1", bg:"#EEF2FF", dot:"#818CF8"},
  "عاجل":              {color:"#DC2626", bg:"#FEF2F2", dot:"#F87171"},
  "قيد التوصيل":       {color:"#F59E0B", bg:"#FFFBEB", dot:"#FCD34D"},
  "قريب من التسليم":   {color:"#8B5CF6", bg:"#F5F3FF", dot:"#A78BFA"},
  "متأخر":             {color:"#EF4444", bg:"#FEF2F2", dot:"#FCA5A5"},
  "مكتمل":             {color:"#10B981", bg:"#ECFDF5", dot:"#34D399"},
  "ملغي":              {color:"#6B7280", bg:"#F9FAFB", dot:"#9CA3AF"},
  "يحتاج مراجعة":      {color:"#F97316", bg:"#FFF7ED", dot:"#FB923C"},
};

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
const genId     = () => "W-" + Date.now().toString().slice(-6);
const nowTime   = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const todayDate = () => new Date().toISOString().split("T")[0];
const fmtDate   = d => d ? new Date(d).toLocaleDateString("ar-LY",{day:"2-digit",month:"short"}) : "-";
const buildWA   = (phone,msg) => `https://wa.me/${phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;

const groupMsgWA = (o, companyName) =>
`🚀 *${companyName}* — طلب جديد!
━━━━━━━━━━━━━━━
🆔 رقم الطلب: ${o.id}
👤 الزبون: ${o.customer_name||"—"}
📞 الهاتف: ${o.clientPhone||"—"}
📦 المرسل: ${o.sender}
🎁 النوع: ${o.package_type}
📝 التفاصيل: ${o.details}
🏠 التوصيل إلى: ${o.destination}
💰 التكلفة: ${o.price} د.ل
🕐 الوقت: ${o.time}
━━━━━━━━━━━━━━━
للاستلام ردوا بـ: *عندي* أو *خديته* 🚗`;

const statusMsgWA = (o, status, driverName, driverPhone) => {
  if(status==="قيد التوصيل") return `🚀 *وصّل*\nمرحباً 👋\nطلبك #${o.id} تم استلامه من *${driverName}*\nرقم المندوب: ${driverPhone}\nسيصلك قريباً ✅`;
  if(status==="قريب من التسليم") return `🚀 *وصّل*\nطلبك #${o.id} على وصول! 🏃\nتجهز للاستلام 📦`;
  if(status==="متأخر") return `🚀 *وصّل*\nنعتذر، طلبك #${o.id} تأخر قليلاً ⏳\nنسعى لتوصيله في أقرب وقت.`;
  if(status==="مكتمل") return `🚀 *وصّل*\n✅ تم توصيل طلبك #${o.id} بنجاح!\nشكراً لثقتكم 🙏`;
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
  id: o.order_id, customer_name: o.customer_name,
  clientPhone: o.client_phone, sender: o.sender,
  package_type: o.package_type, details: o.details,
  destination: o.destination, price: o.price||0,
  status: o.status||"جديد", driver: o.driver_name||null,
  date: o.date, time: o.time, source: o.source||"bot",
  needs_review: o.needs_manual_review||false, raw_message: o.raw_message||null,
});

const toDB = o => ({
  order_id: o.id, customer_name: o.customer_name||null,
  client_phone: o.clientPhone||null, sender: o.sender,
  package_type: o.package_type, details: o.details,
  destination: o.destination, price: o.price||0,
  status: o.status||"جديد", driver_name: o.driver||null,
  date: o.date, time: o.time, source: o.source||"bot",
  needs_manual_review: o.needs_review||false, raw_message: o.raw_message||null,
});

const db = {
  getOrders: async (dateFilter=null) => {
    try {
      let url = `${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`;
      if(dateFilter) url += `&date=eq.${dateFilter}`;
      const r = await fetch(url, {headers:sbH});
      const data = await r.json();
      return Array.isArray(data) ? data.map(fromDB) : [];
    } catch { return []; }
  },
  insertOrder: async (o) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {method:"POST", headers:sbH, body:JSON.stringify(toDB(o))});
      return r.ok;
    } catch { return false; }
  },
  updateOrder: async (id, fields) => {
    try {
      const dbFields = {};
      if(fields.status!==undefined) dbFields.status = fields.status;
      if(fields.driver!==undefined) dbFields.driver_name = fields.driver;
      if(fields.price!==undefined)  dbFields.price = fields.price;
      await fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(id)}`,
        {method:"PATCH", headers:sbH, body:JSON.stringify(dbFields)});
    } catch {}
  },
};

// ══════════════════════════════════════════════
//  SETTINGS DB — إعدادات محفوظة في Supabase
// ══════════════════════════════════════════════
const settingsDB = {
  load: async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=*`, {headers:sbH});
      const data = await r.json();
      if(!Array.isArray(data)) return null;
      const s = {};
      data.forEach(row => { s[row.key] = row.value; });
      return s;
    } catch { return null; }
  },
  saveAll: async (settings) => {
    try {
      const rows = Object.entries(settings).map(([key,value])=>({
        key, value: String(value||""), updated_at: new Date().toISOString()
      }));
      await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
        method:"POST",
        headers:{...sbH, "Prefer":"resolution=merge-duplicates"},
        body: JSON.stringify(rows)
      });
    } catch {}
  }
};

// ══════════════════════════════════════════════
//  BOT API
// ══════════════════════════════════════════════
async function sendMessage(message, phone, companyName) {
  try {
    const r = await fetch("/api/analyze", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({message, phone, companyName}),
    });
    return await r.json();
  } catch {
    return { reply:"تم استلام رسالتك ✅ سيتواصل معك فريقنا قريباً.", order_saved:false };
  }
}

// ══════════════════════════════════════════════
//  WORD EXPORT
// ══════════════════════════════════════════════
function exportReport(orders) {
  const done = orders.filter(o=>o.status==="مكتمل");
  const total = done.reduce((s,o)=>s+Number(o.price),0);
  const today = new Date().toLocaleDateString("ar-LY",{day:"2-digit",month:"long",year:"numeric"});
  const driverStats = {};
  done.forEach(o=>{ if(o.driver){ driverStats[o.driver]=driverStats[o.driver]||{n:0,rev:0}; driverStats[o.driver].n++; driverStats[o.driver].rev+=Number(o.price); }});
  const review = orders.filter(o=>o.needs_review||o.status==="يحتاج مراجعة");

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
.footer{text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #E2E8F0;padding-top:12px;margin-top:24px}
</style></head><body>
<div class="hdr"><div style="font-size:30px">🚀</div><h1>وصّل</h1><p>تقرير المبيعات — ${today}</p></div>
<div class="cards">
  <div class="card"><div class="cv">${orders.length}</div><div class="cl">إجمالي الطلبات</div></div>
  <div class="card"><div class="cv">${done.length}</div><div class="cl">مكتملة</div></div>
  <div class="card"><div class="cv">${total} د.ل</div><div class="cl">الإيرادات</div></div>
  <div class="card"><div class="cv">${review.length}</div><div class="cl">تحتاج مراجعة</div></div>
</div>
<h2>📋 الطلبات المكتملة</h2>
<table><tr><th>#</th><th>رقم الطلب</th><th>الزبون</th><th>المرسل</th><th>التوصيل</th><th>المندوب</th><th>التاريخ</th><th>القيمة</th></tr>
${done.map((o,i)=>`<tr><td>${i+1}</td><td>${o.id}</td><td>${o.customer_name||"—"}</td><td>${o.sender}</td><td>${o.destination}</td><td>${o.driver||"—"}</td><td>${fmtDate(o.date)} ${o.time}</td><td><b>${o.price} د.ل</b></td></tr>`).join("")}
<tr class="tot"><td colspan="7">💰 المجموع</td><td>${total} د.ل</td></tr></table>
<h2>🧑‍💼 أداء الفريق</h2>
<table><tr><th>الاسم</th><th>الطلبات</th><th>الإيرادات</th></tr>
${Object.entries(driverStats).map(([d,v])=>`<tr><td>${d}</td><td>${v.n}</td><td><b>${v.rev} د.ل</b></td></tr>`).join("")||'<tr><td colspan="3" style="text-align:center;color:#94a3b8">لا توجد بيانات</td></tr>'}
</table>
${review.length>0?`<h2>⚠️ طلبات تحتاج مراجعة يدوية</h2>
<table><tr><th>#</th><th>رقم الطلب</th><th>الرسالة الأصلية</th><th>الوقت</th></tr>
${review.map((o,i)=>`<tr class="review"><td>${i+1}</td><td>${o.id}</td><td>${o.raw_message||o.details||"—"}</td><td>${fmtDate(o.date)} ${o.time}</td></tr>`).join("")}
</table>`:""}
<div class="footer">وصّل — ${today}</div></body></html>`;

  const blob=new Blob([html],{type:"application/msword;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`تقرير-وصّل-${todayDate()}.doc`; a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════
//  ATOMS
// ══════════════════════════════════════════════
const Toast=({msg,color})=>(
  <div style={{position:"fixed",top:22,left:"50%",transform:"translateX(-50%)",background:color||"#10B981",color:"#fff",padding:"12px 26px",borderRadius:14,zIndex:9999,fontWeight:700,fontSize:14,boxShadow:"0 8px 24px #0003",pointerEvents:"none",maxWidth:"92vw",textAlign:"center"}}>
    {msg}
  </div>
);

const Badge=({status})=>{
  const s=STATUS_CONFIG[status]||{color:"#64748b",bg:"#F1F5F9",dot:"#94A3B8"};
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:5,color:s.color,background:s.bg,padding:"4px 11px",borderRadius:20,fontSize:11,fontWeight:700,border:`1.5px solid ${s.color}22`}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:s.dot}}/>
      {status}
    </span>
  );
};

// ══════════════════════════════════════════════
//  🖨️ SHIPPING LABEL
// ══════════════════════════════════════════════
function ShippingLabel({order, onClose}) {
  return(
    <div style={{position:"fixed",inset:0,background:"#00000090",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,padding:16}}>
      <div style={{background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:360,direction:"rtl",fontFamily:"'Courier New',monospace",boxShadow:"0 20px 60px #0005"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:800}}>🖨️ ملصق الشحنة</h3>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>window.print()} style={{background:"#6366F1",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>طباعة</button>
            <button onClick={onClose} style={{background:"#F1F5F9",border:"none",borderRadius:8,padding:"7px 12px",fontSize:13,cursor:"pointer"}}>✕</button>
          </div>
        </div>
        <div style={{border:"2px dashed #6366F1",borderRadius:12,padding:16}}>
          <div style={{textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:28}}>🚀</div>
            <div style={{fontWeight:900,fontSize:18,color:"#6366F1"}}>وصّل</div>
          </div>
          <div style={{borderTop:"1px solid #E2E8F0",paddingTop:10,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:11,color:"#64748B"}}>رقم الطلب</span>
              <span style={{fontWeight:800,fontSize:14,color:"#6366F1"}}>#{order.id}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:11,color:"#64748B"}}>التاريخ</span>
              <span style={{fontWeight:600,fontSize:12}}>{fmtDate(order.date)} {order.time}</span>
            </div>
          </div>
          {order.customer_name&&(
            <div style={{background:"#F8FAFF",borderRadius:8,padding:10,marginBottom:10}}>
              <div style={{fontSize:11,color:"#64748B",marginBottom:3}}>👤 الزبون</div>
              <div style={{fontWeight:800,fontSize:15}}>{order.customer_name}</div>
              {order.clientPhone&&<div style={{fontSize:12,color:"#6366F1",marginTop:2}}>📞 {order.clientPhone}</div>}
            </div>
          )}
          <div style={{background:"#F8FAFF",borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{fontSize:11,color:"#64748B",marginBottom:3}}>📦 المرسل</div>
            <div style={{fontWeight:800,fontSize:14}}>{order.sender}</div>
          </div>
          <div style={{background:"#F0FDF4",borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{fontSize:11,color:"#64748B",marginBottom:3}}>🏠 عنوان التسليم</div>
            <div style={{fontWeight:700,fontSize:14}}>{order.destination}</div>
          </div>
          <div style={{background:"#FFFBEB",borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{fontSize:11,color:"#64748B",marginBottom:3}}>📝 تفاصيل الشحنة</div>
            <div style={{fontSize:12}}>{order.package_type} — {order.details}</div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#EEF2FF",borderRadius:8,padding:"10px 14px"}}>
            <span style={{fontSize:13,color:"#6366F1",fontWeight:600}}>💰 التكلفة</span>
            <span style={{fontSize:20,fontWeight:900,color:"#6366F1"}}>{order.price} د.ل</span>
          </div>
          {order.driver&&<div style={{textAlign:"center",marginTop:10,fontSize:11,color:"#64748B"}}>🧑‍💼 المندوب: <strong>{order.driver}</strong></div>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  🤖 WHATSAPP BOT — واجهة الزبون المستقلة
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
    addMsg("bot",`👋 أهلاً وسهلاً في ${settings?.companyName||"وصّل"}! 🚀

خدماتنا متاحة من 9 صباحاً لـ 11 ليلاً 📍 طرابلس وضواحيها

شن نقدر نسوولك اليوم؟ 😊
1️⃣ توصيل بضاعة أو طرد 📦
2️⃣ طلب من مطعم 🍔
3️⃣ شحن بين المدن 🚚
4️⃣ تتبع طلبية
5️⃣ التحدث مع الدعم`);
  },[]);

  const send=async()=>{
    const msg=input.trim();
    if(!msg||loading)return;
    setInput(""); addMsg("user",msg); setLoading(true);
    try {
      const r=await sendMessage(msg, sessionPhone, settings?.companyName||"وصّل");
      addMsg("bot", r.reply||"تم استلام رسالتك ✅");

      if(r.order_saved && r.order_data){
        const o={
          id: r.order_data.id||genId(),
          customer_name: r.order_data.customer_name||null,
          clientPhone: r.order_data.phone||null,
          sender: r.order_data.sender||"غير محدد",
          package_type: r.order_data.package_type||"طرود عامة",
          details: r.order_data.details||msg,
          destination: r.order_data.destination||"غير محدد",
          price: r.order_data.price||0,
          status: "جديد", date: todayDate(), time: nowTime(),
          driver: null, source: "bot", needs_review: false,
        };
        if(onOrderCreated) await onOrderCreated(o);

        if(settings?.waGroupNumber){
          setTimeout(()=>window.open(buildWA(settings.waGroupNumber, groupMsgWA(o, settings?.companyName||"وصّل")),"_blank"),800);
        }
      }

      if(r.escalate && settings?.waGroupNumber){
        setTimeout(()=>window.open(buildWA(settings.waGroupNumber,`🚨 *وصّل* — تحويل للإدارة!\n👤 يحتاج تدخل بشري`),"_blank"),500);
      }
    } catch{ addMsg("bot","حدث خطأ. حاول مجدداً 🔄"); }
    setLoading(false);
  };

  const quickReplies=["عندي توصيلة 📦","طلب من مطعم 🍔","تتبع طلبيتي 🔍","تحدث مع الدعم 💬"];

  const containerStyle = standalone
    ? {minHeight:"100vh",display:"flex",flexDirection:"column",direction:"rtl",fontFamily:"'Segoe UI',Tahoma,sans-serif",background:"#ECE5DD"}
    : {position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",background:"#00000088",padding:12};

  const boxStyle = standalone
    ? {width:"100%",flex:1,display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto"}
    : {width:"100%",maxWidth:420,height:"92vh",maxHeight:720,display:"flex",flexDirection:"column",borderRadius:20,overflow:"hidden",direction:"rtl",fontFamily:"'Segoe UI',Tahoma,sans-serif",boxShadow:"0 24px 64px #0007"};

  return(
    <div style={containerStyle}>
      <div style={boxStyle}>
        {/* HEADER */}
        <div style={{background:"#075E54",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          {!standalone&&(
            <button onClick={onClose} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.8)",fontSize:20,cursor:"pointer"}}>←</button>
          )}
          <div style={{width:42,height:42,borderRadius:"50%",background:"#25D366",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🚀</div>
          <div style={{flex:1}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:15}}>{settings?.companyName||"وصّل"}</div>
            <div style={{color:"rgba(255,255,255,0.65)",fontSize:12}}>🤖 بوت ذكي — متصل ✅</div>
          </div>
          {!standalone&&(
            <button onClick={onClose} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.7)",fontSize:20,cursor:"pointer"}}>✕</button>
          )}
        </div>

        {/* MESSAGES */}
        <div style={{flex:1,overflowY:"auto",background:"#ECE5DD",padding:"12px 10px",display:"flex",flexDirection:"column",gap:6}}>
          {messages.map(m=>(
            <div key={m.id} style={{display:"flex",justifyContent:m.from==="user"?"flex-start":"flex-end"}}>
              <div style={{maxWidth:"82%",background:m.from==="user"?"#fff":"#DCF8C6",borderRadius:m.from==="user"?"16px 16px 16px 4px":"16px 16px 4px 16px",padding:"9px 12px 6px",boxShadow:"0 1px 3px #0002"}}>
                <div style={{fontSize:14,color:"#1a1a1a",whiteSpace:"pre-wrap",lineHeight:1.55}}>{m.text}</div>
                <div style={{fontSize:10,color:"#64748B",marginTop:3,textAlign:"left"}}>{m.time}</div>
              </div>
            </div>
          ))}
          {loading&&(
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <div style={{background:"#DCF8C6",borderRadius:"16px 16px 4px 16px",padding:"12px 16px"}}>
                <div style={{display:"flex",gap:5}}>
                  {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#25D366",animation:`bounce 1s ${i*0.2}s infinite`}}/>)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* QUICK REPLIES */}
        {!loading&&messages.length<=2&&(
          <div style={{background:"#ECE5DD",padding:"0 10px 8px",display:"flex",gap:6,overflowX:"auto",flexShrink:0}}>
            {quickReplies.map(q=>(
              <button key={q} onClick={()=>{setInput(q);setTimeout(()=>document.getElementById("bot-input")?.focus(),50);}}
                style={{background:"#fff",border:"1px solid #25D36655",borderRadius:20,padding:"5px 12px",fontSize:12,color:"#075E54",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",fontWeight:600,flexShrink:0}}>
                {q}
              </button>
            ))}
          </div>
        )}

        {/* INPUT */}
        <div style={{background:"#F0F2F5",padding:"8px 10px",display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
          <div style={{flex:1,background:"#fff",borderRadius:24,padding:"10px 16px",display:"flex",alignItems:"center"}}>
            <input id="bot-input" value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
              placeholder="اكتب رسالتك..." disabled={loading}
              style={{flex:1,border:"none",outline:"none",fontSize:14,fontFamily:"inherit",background:"transparent",direction:"rtl",color:"#1a1a1a"}}/>
          </div>
          <button onClick={send} disabled={!input.trim()||loading}
            style={{width:46,height:46,borderRadius:"50%",background:input.trim()&&!loading?"#25D366":"#94A3B8",border:"none",color:"#fff",fontSize:20,cursor:input.trim()&&!loading?"pointer":"default",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {loading?"⏳":"➤"}
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ORDER CARD
// ══════════════════════════════════════════════
function OrderCard({order, onUpdate, onPrint, settings}) {
  const [open,setOpen]=useState(false);
  const isReview=order.needs_review||order.status==="يحتاج مراجعة";
  const isUrgent=order.status==="عاجل";

  return(
    <div style={{background:"#1E293B",borderRadius:16,marginBottom:10,overflow:"hidden",border:`1.5px solid ${isUrgent?"#DC2626":isReview?"#F97316":open?"#6366F1":"#334155"}`,boxShadow:isUrgent?"0 0 20px #DC262633":"none",transition:"all .2s"}}>
      {isUrgent&&<div style={{background:"linear-gradient(90deg,#DC2626,#EF4444)",height:3}}/>}
      <div onClick={()=>setOpen(!open)} style={{padding:"13px 15px",cursor:"pointer",display:"flex",alignItems:"center",gap:11}}>
        <div style={{fontSize:22,width:42,height:42,background:"#0F172A",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {isReview?"⚠️":isUrgent?"🚨":TYPE_ICON[order.package_type]||"📦"}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,color:"#E2E8F0",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            {order.customer_name||order.sender}
            <span style={{color:"#475569",fontSize:11}}>#{order.id}</span>
            {isUrgent&&<span style={{background:"#FEF2F2",color:"#DC2626",fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:700}}>🚨 عاجل</span>}
            {isReview&&<span style={{background:"#FFF7ED",color:"#F97316",fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:700}}>⚠️ مراجعة</span>}
          </div>
          <div style={{color:"#64748B",fontSize:12,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {order.package_type} • {order.destination}
          </div>
        </div>
        <div style={{textAlign:"center",flexShrink:0}}>
          <Badge status={order.status}/>
          <div style={{color:"#475569",fontSize:11,marginTop:3}}>{order.time}</div>
        </div>
        <div style={{color:"#475569",fontSize:12,transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</div>
      </div>

      {open&&(
        <div style={{padding:"13px 15px 15px",borderTop:"1px solid #334155",background:"#0F172A"}}>
          {isReview&&order.raw_message&&(
            <div style={{background:"#431407",borderRadius:10,padding:"10px 14px",marginBottom:12,border:"1px solid #F97316"}}>
              <div style={{color:"#FB923C",fontSize:12,fontWeight:700,marginBottom:5}}>⚠️ الرسالة الأصلية:</div>
              <div style={{color:"#FED7AA",fontSize:13}}>{order.raw_message}</div>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 14px",fontSize:13,marginBottom:14}}>
            {[["👤 الزبون",order.customer_name||"—"],["📞 الهاتف",order.clientPhone||"—"],["📦 المرسل",order.sender],["🏠 التوصيل",order.destination],["💰 التكلفة",`${order.price} د.ل`],["🧑‍💼 المندوب",order.driver||"—"]].map(([l,v])=>(
              <div key={l}><span style={{color:"#64748B",fontSize:11}}>{l}: </span><span style={{fontWeight:600,color:"#E2E8F0"}}>{v}</span></div>
            ))}
          </div>
          {order.details&&(
            <div style={{background:"#1E293B",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#94A3B8"}}>📝 {order.details}</div>
          )}
          {order.status!=="مكتمل"&&order.status!=="ملغي"&&(
            <div style={{marginBottom:12,display:"flex",gap:8,alignItems:"center"}}>
              <input type="number" placeholder="السعر (د.ل)" defaultValue={order.price||""}
                onBlur={e=>e.target.value&&onUpdate(order.id,"price",Number(e.target.value))}
                style={{flex:1,borderRadius:9,border:"1px solid #334155",padding:"8px 12px",fontSize:13,fontFamily:"inherit",background:"#1E293B",color:"#E2E8F0",outline:"none"}}/>
              <span style={{color:"#64748B",fontSize:12}}>د.ل</span>
            </div>
          )}
          {order.status!=="مكتمل"&&order.status!=="ملغي"&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#64748B",marginBottom:8}}>تحديث الحالة:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {[["قيد التوصيل","#F59E0B"],["قريب من التسليم","#8B5CF6"],["متأخر","#EF4444"],["مكتمل","#10B981"],["ملغي","#6B7280"]].filter(([st])=>st!==order.status).map(([st,c])=>(
                  <button key={st} onClick={()=>onUpdate(order.id,"status",st)}
                    style={{background:c,color:"#fff",border:"none",borderRadius:9,padding:"7px 13px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}
          {order.status!=="مكتمل"&&order.status!=="ملغي"&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#64748B",marginBottom:6}}>تعيين مندوب:</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {TEAM.map(m=>(
                  <button key={m.name} onClick={()=>onUpdate(order.id,"driver",m.name)}
                    style={{background:order.driver===m.name?"#6366F1":"#1E293B",color:order.driver===m.name?"#fff":"#94A3B8",border:`1px solid ${order.driver===m.name?"#6366F1":"#334155"}`,borderRadius:9,padding:"7px 13px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                    🧑‍💼 {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={()=>onPrint(order)}
              style={{background:"#6366F1",color:"#fff",border:"none",borderRadius:9,padding:"8px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
              🖨️ طباعة ملصق
            </button>
            {order.clientPhone&&order.status!=="جديد"&&order.status!=="يحتاج مراجعة"&&(
              <a href={buildWA(order.clientPhone, statusMsgWA(order,order.status,order.driver,TEAM.find(m=>m.name===order.driver)?.phone||""))}
                target="_blank" rel="noreferrer"
                style={{background:"#25D366",color:"#fff",borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,textDecoration:"none"}}>
                📱 إشعار الزبون
              </a>
            )}
            {order.clientPhone&&(
              <a href={`tel:${order.clientPhone}`}
                style={{background:"#1E293B",border:"1px solid #334155",color:"#94A3B8",borderRadius:9,padding:"8px 12px",fontSize:14,textDecoration:"none",display:"flex",alignItems:"center"}}>
                📞
              </a>
            )}
          </div>
          {settings?.waGroupNumber&&(
            <div style={{marginTop:10}}>
              <a href={buildWA(settings.waGroupNumber, groupMsgWA(order, settings?.companyName||"وصّل"))} target="_blank" rel="noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:6,background:"#064E3B",color:"#4ADE80",border:"1px solid #065F46",borderRadius:9,padding:"7px 14px",fontSize:12,fontWeight:700,textDecoration:"none"}}>
                📢 إرسال للجروب
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  ADMIN LOGIN
// ══════════════════════════════════════════════
function AdminLogin({onLogin}) {
  const [pin,setPin]=useState("");
  const [shake,setShake]=useState(false);
  const [tries,setTries]=useState(0);
  const tryLogin=()=>{if(pin===ADMIN_PIN){onLogin();}else{setShake(true);setPin("");setTries(t=>t+1);setTimeout(()=>setShake(false),500);}};
  const press=v=>{if(v==="⌫")setPin(p=>p.slice(0,-1));else if(v==="✓")tryLogin();else if(pin.length<4)setPin(p=>p+v);};
  useEffect(()=>{if(pin.length===4)tryLogin();},[pin]);

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0F172A 0%,#1E1B4B 60%,#0F172A 100%)",display:"flex",alignItems:"center",justifyContent:"center",direction:"rtl",fontFamily:"'Segoe UI',Tahoma,sans-serif"}}>
      <div style={{background:"rgba(255,255,255,0.05)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:24,padding:"40px 34px",width:300,textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:8}}>🚀</div>
        <h2 style={{color:"#fff",margin:"0 0 4px",fontSize:21,fontWeight:800}}>وصّل — الإدارة</h2>
        <p style={{color:"#94A3B8",fontSize:13,margin:"0 0 26px"}}>أدخل رمز الدخول</p>
        <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:28}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:14,height:14,borderRadius:"50%",background:i<pin.length?"#818CF8":"transparent",border:`2px solid ${i<pin.length?"#818CF8":"#475569"}`,transition:"all .2s"}}/>)}
        </div>
        <div style={{animation:shake?"shake .4s":"none"}}>
          {[["1","2","3"],["4","5","6"],["7","8","9"],["⌫","0","✓"]].map((row,ri)=>(
            <div key={ri} style={{display:"flex",gap:10,justifyContent:"center",marginBottom:10}}>
              {row.map(v=>(
                <button key={v} onClick={()=>press(v)}
                  style={{width:76,height:56,borderRadius:14,border:`1.5px solid ${v==="✓"?"#6366F1":"rgba(255,255,255,0.1)"}`,background:v==="✓"?"#6366F1":"rgba(255,255,255,0.06)",color:v==="✓"?"#fff":"#E2E8F0",fontSize:v==="⌫"||v==="✓"?20:22,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  {v}
                </button>
              ))}
            </div>
          ))}
        </div>
        {tries>0&&<p style={{color:"#F87171",fontSize:13,marginTop:14}}>❌ رمز خاطئ ({tries} محاولة)</p>}
        <p style={{color:"#374151",fontSize:12,marginTop:18}}>الرمز الافتراضي: 1234</p>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════
function Dashboard({orders,onAdd,onUpdate,onLogout,settings,setSettings,onOpenBot,dbStatus}) {
  const [tab,setTab]=useState("orders");
  const [filter,setFilter]=useState("الكل");
  const [search,setSearch]=useState("");
  const [dateFilter,setDateFilter]=useState("الكل");
  const [printOrder,setPrintOrder]=useState(null);
  const [showSettings,setShowSettings]=useState(false);
  const [localS,setLocalS]=useState({...settings});
  const [exporting,setExporting]=useState(false);

  const FILTERS=["الكل","عاجل","يحتاج مراجعة","جديد","قيد التوصيل","قريب من التسليم","متأخر","مكتمل","ملغي"];

  const dateFilteredOrders = dateFilter==="اليوم"
    ? orders.filter(o=>o.date===todayDate())
    : dateFilter==="الأسبوع"
    ? orders.filter(o=>{ const d=new Date(o.date); const week=new Date(); week.setDate(week.getDate()-7); return d>=week; })
    : orders;

  const filtered=dateFilteredOrders.filter(o=>{
    const mf=filter==="الكل"||o.status===filter||(filter==="يحتاج مراجعة"&&o.needs_review);
    const ms=!search||(o.customer_name||"").includes(search)||o.id.includes(search)||(o.clientPhone||"").includes(search)||o.sender.includes(search)||(o.destination||"").includes(search);
    return mf&&ms;
  });

  const stats={
    total:dateFilteredOrders.length,
    urgent:dateFilteredOrders.filter(o=>o.status==="عاجل").length,
    review:dateFilteredOrders.filter(o=>o.needs_review||o.status==="يحتاج مراجعة").length,
    new:dateFilteredOrders.filter(o=>o.status==="جديد").length,
    active:dateFilteredOrders.filter(o=>["قيد التوصيل","قريب من التسليم"].includes(o.status)).length,
    delayed:dateFilteredOrders.filter(o=>o.status==="متأخر").length,
    done:dateFilteredOrders.filter(o=>o.status==="مكتمل").length,
    revenue:dateFilteredOrders.filter(o=>o.status==="مكتمل").reduce((s,o)=>s+Number(o.price),0),
  };

  const driverStats={};
  dateFilteredOrders.filter(o=>o.status==="مكتمل").forEach(o=>{
    if(o.driver){driverStats[o.driver]=driverStats[o.driver]||{n:0,rev:0};driverStats[o.driver].n++;driverStats[o.driver].rev+=Number(o.price);}
  });

  const last7days = Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-i);
    const dateStr=d.toISOString().split("T")[0];
    return {date:d.toLocaleDateString("ar-LY",{day:"2-digit",month:"short"}), count:orders.filter(o=>o.date===dateStr).length};
  }).reverse();
  const maxCount = Math.max(...last7days.map(d=>d.count), 1);

  return(
    <div style={{direction:"rtl",fontFamily:"'Segoe UI',Tahoma,sans-serif",minHeight:"100vh",background:"#0F172A",color:"#E2E8F0"}}>
      {printOrder&&<ShippingLabel order={printOrder} onClose={()=>setPrintOrder(null)}/>}

      {showSettings&&(
        <div style={{position:"fixed",inset:0,background:"#00000090",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16}}>
          <div style={{background:"#1E293B",borderRadius:20,padding:26,width:"100%",maxWidth:400,direction:"rtl",border:"1px solid #334155",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{margin:0,fontSize:17,color:"#E2E8F0",fontWeight:800}}>⚙️ الإعدادات</h3>
              <button onClick={()=>setShowSettings(false)} style={{background:"#334155",border:"none",borderRadius:9,width:32,height:32,cursor:"pointer",color:"#94A3B8",fontSize:16}}>✕</button>
            </div>
            {[["اسم الشركة","companyName","وصّل"],["رقم جروب الواتساب","waGroupNumber","218912345678"],["رقم واتساب الإدارة","adminPhone","218911111111"]].map(([lb,k,ph])=>(
              <div key={k} style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:12,color:"#94A3B8",marginBottom:5,fontWeight:600}}>{lb}</label>
                <input placeholder={ph} value={localS[k]||""} onChange={e=>setLocalS(l=>({...l,[k]:e.target.value}))}
                  style={{width:"100%",borderRadius:10,border:"1px solid #334155",padding:"10px 13px",fontSize:14,fontFamily:"inherit",boxSizing:"border-box",background:"#0F172A",color:"#E2E8F0",outline:"none"}}/>
              </div>
            ))}
            <div style={{background:"#0F172A",borderRadius:10,padding:12,marginBottom:14,border:"1px solid #334155"}}>
              <div style={{fontSize:12,color:"#64748B",marginBottom:8}}>👥 الفريق</div>
              {TEAM.map((m,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,fontSize:13}}>
                  <span style={{color:"#6366F1"}}>🧑‍💼</span>
                  <span style={{color:"#E2E8F0",fontWeight:600}}>{m.name}</span>
                  <span style={{color:"#64748B",fontSize:11}}>{m.role}</span>
                </div>
              ))}
            </div>
            <button onClick={async()=>{setSettings(localS);await settingsDB.saveAll(localS);setShowSettings(false);}}
              style={{width:"100%",background:"linear-gradient(135deg,#6366F1,#818CF8)",color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
              💾 حفظ
            </button>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={{background:"#1E293B",borderBottom:"1px solid #334155",padding:"0 16px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:58}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>🚀</span>
            <div>
              <div style={{color:"#fff",fontWeight:900,fontSize:15}}>{settings.companyName||"وصّل"}</div>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:dbStatus==="ok"?"#10B981":"#F43F5E",display:"inline-block"}}/>
                <span style={{color:"#475569",fontSize:10}}>Supabase {dbStatus==="ok"?"✅":"..."}</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            {stats.urgent>0&&(
              <button onClick={()=>setFilter("عاجل")}
                style={{background:"#FEF2F2",color:"#DC2626",border:"1px solid #DC2626",borderRadius:9,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                🚨 {stats.urgent}
              </button>
            )}
            {stats.review>0&&(
              <button onClick={()=>setFilter("يحتاج مراجعة")}
                style={{background:"#FFF7ED",color:"#F97316",border:"1px solid #F97316",borderRadius:9,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                ⚠️ {stats.review}
              </button>
            )}
            <button onClick={onOpenBot} style={{background:"#25D366",color:"#fff",border:"none",borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🤖 بوت</button>
            <button onClick={()=>{setExporting(true);exportReport(dateFilteredOrders);setTimeout(()=>setExporting(false),1200);}}
              style={{background:"#10B981",color:"#fff",border:"none",borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {exporting?"⏳":"📊"}
            </button>
            <button onClick={()=>setShowSettings(true)} style={{background:"#334155",color:"#94A3B8",border:"none",borderRadius:9,padding:"7px 11px",fontSize:16,cursor:"pointer"}}>⚙️</button>
            <button onClick={onLogout} style={{background:"transparent",color:"#475569",border:"1px solid #334155",borderRadius:9,padding:"7px 11px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>🔒</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:860,margin:"0 auto",padding:"16px 14px"}}>
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {["الكل","اليوم","الأسبوع"].map(d=>(
            <button key={d} onClick={()=>setDateFilter(d)}
              style={{background:dateFilter===d?"#6366F1":"#1E293B",color:dateFilter===d?"#fff":"#64748B",border:`1px solid ${dateFilter===d?"#6366F1":"#334155"}`,borderRadius:20,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {d==="الكل"?"📅 الكل":d==="اليوم"?"🌅 اليوم":"📆 الأسبوع"}
            </button>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
          {[["📋",stats.total,"إجمالي","#6366F1"],["✅",stats.done,"مكتمل","#10B981"],["🚴",stats.active,"جاري","#F59E0B"],["💰",`${stats.revenue}د.ل`,"إيرادات","#34D399"]].map(([ic,val,lb,c])=>(
            <div key={lb} style={{background:"#1E293B",borderRadius:13,padding:"12px 10px",border:"1px solid #334155",borderTop:`3px solid ${c}`,textAlign:"center"}}>
              <div style={{fontSize:17}}>{ic}</div>
              <div style={{fontSize:lb==="إيرادات"?13:20,fontWeight:900,color:c,margin:"4px 0 2px"}}>{val}</div>
              <div style={{fontSize:10,color:"#64748B"}}>{lb}</div>
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:4,marginBottom:16,background:"#1E293B",borderRadius:12,padding:4,border:"1px solid #334155"}}>
          {[["orders","📦 الطلبات"],["stats","📊 إحصائيات"],["team","👥 الفريق"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)}
              style={{flex:1,background:tab===v?"#6366F1":"transparent",color:tab===v?"#fff":"#64748B",border:"none",borderRadius:8,padding:"9px 6px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
              {l}
            </button>
          ))}
        </div>

        {tab==="orders"&&(
          <>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <input placeholder="🔍 بحث..." value={search} onChange={e=>setSearch(e.target.value)}
                style={{flex:1,borderRadius:10,border:"1px solid #334155",padding:"10px 14px",fontSize:13,fontFamily:"inherit",background:"#1E293B",color:"#E2E8F0",outline:"none"}}/>
              <button onClick={onOpenBot} style={{background:"#25D366",color:"#fff",border:"none",borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>🤖 طلب جديد</button>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
              {FILTERS.map(f=>{
                const sc=STATUS_CONFIG[f];
                const active=filter===f;
                const cnt=f==="الكل"?dateFilteredOrders.length:f==="يحتاج مراجعة"?stats.review:dateFilteredOrders.filter(o=>o.status===f).length;
                return(
                  <button key={f} onClick={()=>setFilter(f)}
                    style={{background:active?(sc?.color||"#6366F1"):"#1E293B",color:active?"#fff":"#64748B",border:`1px solid ${active?(sc?.color||"#6366F1"):"#334155"}`,borderRadius:20,padding:"6px 13px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                    {f}{cnt>0?` (${cnt})`:""}
                  </button>
                );
              })}
            </div>
            {filtered.length===0
              ?<div style={{textAlign:"center",color:"#475569",padding:"40px 0"}}><div style={{fontSize:34,marginBottom:10}}>📭</div>لا توجد طلبات</div>
              :filtered.map(o=><OrderCard key={o.id} order={o} onUpdate={onUpdate} onPrint={setPrintOrder} settings={settings}/>)
            }
          </>
        )}

        {tab==="stats"&&(
          <>
            <div style={{background:"#1E293B",borderRadius:13,padding:18,border:"1px solid #334155",marginBottom:12}}>
              <h3 style={{margin:"0 0 16px",fontSize:14}}>📈 الطلبات آخر 7 أيام</h3>
              <div style={{display:"flex",gap:6,alignItems:"flex-end",height:80}}>
                {last7days.map((d,i)=>(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <div style={{fontSize:11,color:"#6366F1",fontWeight:700}}>{d.count||""}</div>
                    <div style={{width:"100%",background:d.count>0?"#6366F1":"#334155",borderRadius:"4px 4px 0 0",height:`${(d.count/maxCount)*60}px`,minHeight:d.count>0?8:2,transition:"height .5s"}}/>
                    <div style={{fontSize:9,color:"#64748B",textAlign:"center"}}>{d.date}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
              {[["📋",stats.total,"إجمالي","#6366F1"],["🆕",stats.new,"جديدة","#818CF8"],["🚴",stats.active,"جارية","#F59E0B"],["✅",stats.done,"مكتملة","#10B981"],["🔴",stats.delayed,"متأخرة","#EF4444"],["⚠️",stats.review,"مراجعة","#F97316"]].map(([ic,val,lb,c])=>(
                <div key={lb} style={{background:"#1E293B",borderRadius:13,padding:"14px 12px",border:"1px solid #334155",borderTop:`3px solid ${c}`,textAlign:"center"}}>
                  <div style={{fontSize:18}}>{ic}</div>
                  <div style={{fontSize:20,fontWeight:900,color:c,margin:"4px 0 2px"}}>{val}</div>
                  <div style={{fontSize:10,color:"#64748B"}}>{lb}</div>
                </div>
              ))}
            </div>
            <div style={{background:"#1E293B",borderRadius:13,padding:18,border:"1px solid #334155",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:14,color:"#94A3B8"}}>💰 إجمالي الإيرادات</span>
              <span style={{fontSize:24,fontWeight:900,color:"#34D399"}}>{stats.revenue} د.ل</span>
            </div>
            <div style={{background:"#1E293B",borderRadius:13,padding:18,border:"1px solid #334155"}}>
              <h3 style={{margin:"0 0 14px",fontSize:14}}>توزيع الطلبات حسب النوع</h3>
              {SHIPMENT_TYPES.map(t=>{
                const cnt=dateFilteredOrders.filter(o=>o.package_type===t).length;
                const pct=dateFilteredOrders.length?Math.round(cnt/dateFilteredOrders.length*100):0;
                return(<div key={t} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                    <span>{TYPE_ICON[t]} {t}</span><span style={{color:"#818CF8",fontWeight:700}}>{cnt} ({pct}%)</span>
                  </div>
                  <div style={{background:"#334155",borderRadius:6,height:7}}>
                    <div style={{background:"linear-gradient(90deg,#6366F1,#818CF8)",height:"100%",width:`${pct}%`,borderRadius:6,transition:"width .6s"}}/>
                  </div>
                </div>);
              })}
            </div>
          </>
        )}

        {tab==="team"&&(
          <div style={{background:"#1E293B",borderRadius:13,padding:18,border:"1px solid #334155"}}>
            <h3 style={{margin:"0 0 16px",fontSize:14}}>👥 أداء الفريق</h3>
            {TEAM.map(m=>{
              const ds=driverStats[m.name];
              const active=dateFilteredOrders.filter(o=>["قيد التوصيل","قريب من التسليم"].includes(o.status)&&o.driver===m.name).length;
              return(
                <div key={m.name} style={{display:"flex",alignItems:"center",gap:13,padding:"14px 0",borderBottom:"1px solid #334155"}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:active>0?"linear-gradient(135deg,#F59E0B,#D97706)":"linear-gradient(135deg,#10B981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🧑‍💼</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:8}}>
                      {m.name}
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:active>0?"#FEF3C7":"#DCFCE7",color:active>0?"#D97706":"#16A34A",fontWeight:700}}>
                        {active>0?`${active} جارية 🟡`:"متاح ✅"}
                      </span>
                      <span style={{fontSize:10,color:"#475569"}}>{m.role}</span>
                    </div>
                    <div style={{fontSize:12,color:"#64748B",marginTop:3}}>
                      {ds?`${ds.n} طلب مكتمل • ${ds.rev} د.ل`:"لا توجد طلبات مكتملة"}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:16,fontWeight:800,color:"#10B981"}}>{ds?.rev||0}</div>
                      <div style={{fontSize:9,color:"#64748B"}}>د.ل</div>
                    </div>
                    <a href={buildWA(m.phone,"")} target="_blank" rel="noreferrer"
                      style={{background:"#25D366",color:"#fff",borderRadius:9,padding:"7px 12px",fontSize:13,fontWeight:700,textDecoration:"none"}}>📱</a>
                  </div>
                </div>
              );
            })}
            {settings.waGroupNumber&&(
              <div style={{marginTop:16,background:"#0F172A",borderRadius:12,padding:"14px 16px",border:"1px solid #334155",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{color:"#4ADE80",fontWeight:700,fontSize:13}}>📢 جروب الفريق</div>
                  <div style={{color:"#64748B",fontSize:11,marginTop:2}}>{settings.waGroupNumber}</div>
                </div>
                <a href={buildWA(settings.waGroupNumber,"مرحباً الفريق 👋")} target="_blank" rel="noreferrer"
                  style={{background:"#25D366",color:"#fff",borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:700,textDecoration:"none"}}>
                  📱 فتح الجروب
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ROOT APP — يكشف الصفحة حسب الرابط
// ══════════════════════════════════════════════
export default function App() {
  // كشف إذا الزبون جاء على /bot أو ?bot=1
  const isCustomerView = window.location.pathname==="/bot" || new URLSearchParams(window.location.search).get("bot")==="1";

  const [page,     setPage]     = useState(isCustomerView ? "bot" : "login");
  const [orders,   setOrders]   = useState([]);
  const [settings, setSettings] = useState({companyName:"وصّل", waGroupNumber:"", adminPhone:""});
  const [toast,    setToast]    = useState(null);
  const [showBot,  setShowBot]  = useState(false);
  const [dbStatus, setDbStatus] = useState("connecting");
  const [loading,  setLoading]  = useState(!isCustomerView);

  const showToast=(msg,color="#10B981")=>{
    setToast({msg,color});
    try {
      const ctx=new AudioContext();
      const o=ctx.createOscillator();
      const g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(800,ctx.currentTime);
      o.frequency.setValueAtTime(600,ctx.currentTime+0.1);
      g.gain.setValueAtTime(0.3,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);
      o.start(); o.stop(ctx.currentTime+0.3);
    } catch {}
    setTimeout(()=>setToast(null),3200);
  };

  useEffect(()=>{
    if(isCustomerView) return; // الزبون لا يحتاج تحميل الطلبات
    const load=async()=>{
      // تحميل الإعدادات من Supabase
      const savedSettings = await settingsDB.load();
      if(savedSettings && Object.keys(savedSettings).length > 0){
        setSettings(prev=>({...prev, ...savedSettings}));
      }
      // تحميل الطلبات
      const data=await db.getOrders();
      setOrders(data);
      setDbStatus(data!==null?"ok":"error");
      setLoading(false);
    };
    load();
    const interval=setInterval(async()=>{
      const data=await db.getOrders();
      if(data){
        setOrders(prev=>{
          const newOnes=data.filter(o=>!prev.find(p=>p.id===o.id));
          if(newOnes.length>0){
            newOnes.forEach(o=>{
              if(o.status==="عاجل") showToast(`🚨 طلب عاجل من ${o.customer_name||o.sender}!`,"#DC2626");
              else showToast(`🔔 طلب جديد من ${o.customer_name||o.sender}!`,"#6366F1");
            });
          }
          return data;
        });
        setDbStatus("ok");
      }
    },8000);
    return()=>clearInterval(interval);
  },[]);

  const addOrder=useCallback(async(o)=>{
    const saved=await db.insertOrder(o);
    if(saved){
      setOrders(prev=>[o,...prev]);
      if(o.status==="عاجل") showToast(`🚨 طلب عاجل من ${o.customer_name||o.sender}!`,"#DC2626");
      else showToast(`✅ طلب جديد من ${o.customer_name||o.sender}!`,"#6366F1");
    } else {
      setOrders(prev=>[o,...prev]);
      showToast("⚠️ حُفظ محلياً فقط","#F59E0B");
    }
  },[]);

  const updateOrder=useCallback(async(id,k,v)=>{
    await db.updateOrder(id,{[k]:v});
    setOrders(prev=>prev.map(o=>o.id===id?{...o,[k]:v}:o));
    showToast(k==="status"?`📦 "${v}"`:`🧑‍💼 تعيين ${v}`);
  },[]);

  // واجهة الزبون المستقلة — بدون PIN
  if(isCustomerView){
    return(
      <>
        {toast&&<Toast msg={toast.msg} color={toast.color}/>}
        <WhatsAppBot
          onOrderCreated={addOrder}
          settings={settings}
          onClose={null}
          standalone={true}
        />
      </>
    );
  }

  if(loading) return(
    <div style={{minHeight:"100vh",background:"#0F172A",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontFamily:"'Segoe UI',Tahoma,sans-serif"}}>
      <div style={{fontSize:56}}>🚀</div>
      <div style={{color:"#fff",fontSize:20,fontWeight:900}}>وصّل</div>
      <div style={{color:"#64748B",fontSize:14}}>جاري الاتصال...</div>
      <div style={{width:36,height:36,border:"3px solid #334155",borderTop:"3px solid #6366F1",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {showBot&&<WhatsAppBot onOrderCreated={addOrder} settings={settings} onClose={()=>setShowBot(false)}/>}
      {page==="login"&&<AdminLogin onLogin={()=>setPage("dashboard")}/>}
      {page==="dashboard"&&(
        <Dashboard orders={orders} onAdd={addOrder} onUpdate={updateOrder}
          onLogout={()=>setPage("login")} settings={settings} setSettings={setSettings}
          onOpenBot={()=>setShowBot(true)} dbStatus={dbStatus}/>
      )}
    </>
  );
}
