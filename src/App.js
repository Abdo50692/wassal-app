import { useState, useRef, useEffect, useCallback } from "react";

// ══════════════════════════════════════════════
//  🎨 ثيم خُطوة — أزرق داكن احترافي
// ══════════════════════════════════════════════
const T = {
  bg:      "#0F1117",
  bg2:     "#161B27",
  card:    "#1C2333",
  card2:   "#222A3F",
  border:  "#2A3550",
  blue:    "#4F6EF5",
  blue2:   "#3B5BDB",
  blue3:   "#1E2D6B",
  blueL:   "#EEF2FF",
  text:    "#E8EDF5",
  text2:   "#A0AABF",
  muted:   "#6674A0",
  green:   "#12B886",
  greenD:  "#0B7A5E",
  orange:  "#F76707",
  red:     "#FA5252",
  purple:  "#7950F2",
  yellow:  "#FAB005",
  cyan:    "#15AABF",
  shadow:  "0 2px 16px rgba(0,0,0,0.4)",
  shadow2: "0 8px 32px rgba(0,0,0,0.5)",
};

const STATUS_CONFIG = {
  "جديدة":              {color:T.blue,   bg:"#1E2D6B", dot:"#748FFC"},
  "تم الاستلام":        {color:T.cyan,   bg:"#0C2833", dot:"#3BC9DB"},
  "في الطريق":          {color:T.orange, bg:"#2D1A07", dot:"#FFA94D"},
  "قريب من التسليم":    {color:T.purple, bg:"#1F1147", dot:"#9775FA"},
  "تم التسليم":         {color:T.green,  bg:"#0A2B20", dot:"#51CF66"},
  "مؤجلة":              {color:T.yellow, bg:"#2D2207", dot:"#FFD43B"},
  "مرتجعة":             {color:T.red,    bg:"#2D0A0A", dot:"#FF6B6B"},
  "ملغية":              {color:T.muted,  bg:"#1A1A2E", dot:"#868E96"},
  "يحتاج مراجعة":       {color:T.orange, bg:"#2D1A07", dot:"#FFA94D"},
  "عاجلة":              {color:T.red,    bg:"#2D0A0A", dot:"#FF6B6B"},
};

const TYPE_ICON = {
  "ملابس":"👕","لحوم ومواد غذائية":"🥩","شحنات من مناطق أخرى":"🚛",
  "طرود عامة":"📦","وثائق":"📄","مطعم":"🍔","أخرى":"🔄","أدوية":"💊","إلكترونيات":"📱"
};

// ══════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════
const SUPABASE_URL = "https://iwivofotgjianvthgntm.supabase.co";
const SUPABASE_KEY = "sb_publishable_WLNGtMZR3yXbDrd3vFwMkQ_VWa4J2Ln";

const sbH = {
  "Content-Type":"application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer": "return=representation"
};

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
const genCode   = () => "KH-" + Date.now().toString().slice(-6);
const nowTime   = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const todayDate = () => new Date().toISOString().split("T")[0];
const fmtDate   = d => d ? new Date(d).toLocaleDateString("ar-LY",{day:"2-digit",month:"short"}) : "-";
const fmtNum    = n => Number(n||0).toLocaleString("en-US");
const buildWA   = (phone,msg) => `https://wa.me/${phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;
const calcFinal = (price,disc) => disc>0 ? Math.round(price*(1-disc/100)) : Number(price||0);

// ══════════════════════════════════════════════
//  SUPABASE API
// ══════════════════════════════════════════════
const db = {
  // الشحنات
  getShipments: async (filters={}) => {
    try {
      let url = `${SUPABASE_URL}/rest/v1/shipments?select=*&order=created_at.desc`;
      if(filters.status) url += `&status=eq.${encodeURIComponent(filters.status)}`;
      if(filters.driver_id) url += `&driver_id=eq.${filters.driver_id}`;
      if(filters.date) url += `&date=eq.${filters.date}`;
      const r = await fetch(url,{headers:sbH});
      const d = await r.json();
      return Array.isArray(d)?d:[];
    } catch { return []; }
  },
  insertShipment: async (s) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/shipments`,{method:"POST",headers:sbH,body:JSON.stringify(s)});
      const d = await r.json();
      return Array.isArray(d)?d[0]:d;
    } catch { return null; }
  },
  updateShipment: async (id, fields) => {
    try {
      fields.updated_at = new Date().toISOString();
      if(fields.status==="تم التسليم") fields.delivered_at = new Date().toISOString();
      await fetch(`${SUPABASE_URL}/rest/v1/shipments?id=eq.${id}`,{method:"PATCH",headers:sbH,body:JSON.stringify(fields)});
    } catch {}
  },

  // المناديب
  getDrivers: async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/drivers?select=*&order=name`,{headers:sbH});
      const d = await r.json();
      return Array.isArray(d)?d:[];
    } catch { return []; }
  },
  insertDriver: async (d) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/drivers`,{method:"POST",headers:sbH,body:JSON.stringify(d)});
      return r.ok;
    } catch { return false; }
  },
  updateDriver: async (id, fields) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/drivers?id=eq.${id}`,{method:"PATCH",headers:sbH,body:JSON.stringify(fields)});
    } catch {}
  },
  getDriverByPhone: async (phone, pin) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/drivers?phone=eq.${encodeURIComponent(phone)}&pin=eq.${pin}&select=*`,{headers:sbH});
      const d = await r.json();
      return Array.isArray(d)&&d.length>0?d[0]:null;
    } catch { return null; }
  },

  // المحادثات
  getConversations: async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/conversations?select=*&order=last_message_at.desc`,{headers:sbH});
      const d = await r.json();
      return Array.isArray(d)?d:[];
    } catch { return []; }
  },

  // الإعدادات
  getSettings: async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=*`,{headers:sbH});
      const d = await r.json();
      if(!Array.isArray(d)) return {};
      const s={};
      d.forEach(row=>{s[row.key]=row.value;});
      return s;
    } catch { return {}; }
  },
  saveSettings: async (obj) => {
    try {
      const rows = Object.entries(obj).map(([key,value])=>({key,value:String(value||""),updated_at:new Date().toISOString()}));
      await fetch(`${SUPABASE_URL}/rest/v1/settings`,{method:"POST",headers:{...sbH,"Prefer":"resolution=merge-duplicates"},body:JSON.stringify(rows)});
    } catch {}
  },
};

// تيليغرام
async function sendTG(token, chatId, text) {
  if(!token||!chatId) return;
  try { await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chatId,text,parse_mode:"Markdown"})}); }
  catch {}
}

// ══════════════════════════════════════════════
//  BARCODE
// ══════════════════════════════════════════════
function Barcode({value, width=260, height=48}) {
  const ref = useRef(null);
  useEffect(()=>{
    if(!ref.current||!value) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0,0,width,height);
    ctx.fillStyle = "#000";
    let x = 6;
    for(let i=0;i<value.length;i++){
      const code = value.charCodeAt(i);
      for(let b=0;b<8;b++){
        if((code>>b)&1) ctx.fillRect(x,3,2,height-12);
        x+=2;
      }
      x+=2;
    }
    ctx.fillStyle = "#555";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(value, width/2, height-2);
  },[value]);
  return <canvas ref={ref} width={width} height={height} style={{display:"block",margin:"0 auto",borderRadius:3}}/>;
}

// ══════════════════════════════════════════════
//  ATOMS
// ══════════════════════════════════════════════
const Badge = ({status,size="sm"}) => {
  const s = STATUS_CONFIG[status]||{color:T.muted,bg:"#1A1A2E",dot:"#868E96"};
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,color:s.color,background:s.bg,padding:size==="lg"?"5px 14px":"3px 9px",borderRadius:20,fontSize:size==="lg"?13:11,fontWeight:700,border:`1px solid ${s.color}33`,whiteSpace:"nowrap"}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:s.dot}}/>{status}
    </span>
  );
};

const Toast = ({msg,color}) => (
  <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:color||T.green,color:"#fff",padding:"11px 22px",borderRadius:12,zIndex:9999,fontWeight:700,fontSize:14,boxShadow:T.shadow2,pointerEvents:"none",maxWidth:"90vw",textAlign:"center",fontFamily:"inherit"}}>
    {msg}
  </div>
);

const Stat = ({icon,label,value,color=T.blue,sub}) => (
  <div style={{background:T.card,borderRadius:12,padding:"14px 16px",border:`1px solid ${T.border}`,borderTop:`3px solid ${color}`}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
      <span style={{fontSize:18}}>{icon}</span>
      <span style={{fontSize:11,color:T.muted,fontWeight:600}}>{label}</span>
    </div>
    <div style={{fontSize:22,fontWeight:900,color,fontFamily:"monospace"}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:T.muted,marginTop:3}}>{sub}</div>}
  </div>
);

const Inp = ({value,onChange,placeholder="",type="text",style={}}) => (
  <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{width:"100%",borderRadius:9,border:`1.5px solid ${T.border}`,padding:"10px 12px",fontSize:13,fontFamily:"inherit",background:T.bg2,color:T.text,outline:"none",boxSizing:"border-box",...style}}
    onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>
);

const Sel = ({value,onChange,children,style={}}) => (
  <select value={value} onChange={e=>onChange(e.target.value)}
    style={{width:"100%",borderRadius:9,border:`1.5px solid ${T.border}`,padding:"10px 12px",fontSize:13,fontFamily:"inherit",background:T.bg2,color:T.text,outline:"none",boxSizing:"border-box",...style}}>
    {children}
  </select>
);

const Btn = ({children,onClick,color=T.blue,style={},disabled=false}) => (
  <button onClick={onClick} disabled={disabled}
    style={{background:disabled?"#333":color,color:"#fff",border:"none",borderRadius:9,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:disabled?"default":"pointer",fontFamily:"inherit",transition:"opacity .2s",...style}}
    onMouseOver={e=>!disabled&&(e.target.style.opacity=".85")} onMouseOut={e=>e.target.style.opacity="1"}>
    {children}
  </button>
);

// ══════════════════════════════════════════════
//  🖨️ بوليصة الشحن
// ══════════════════════════════════════════════
function ShipmentLabel({shipment, company, onClose}) {
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:800,padding:16}}>
      <div style={{background:"#fff",borderRadius:16,padding:22,width:"100%",maxWidth:380,direction:"rtl",color:"#16181D",boxShadow:T.shadow2,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:800}}>🖨️ بوليصة الشحن</h3>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>window.print()} style={{background:T.blue,color:"#fff",border:"none",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>طباعة</button>
            <button onClick={onClose} style={{background:"#F1F3F5",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",color:"#555"}}>✕</button>
          </div>
        </div>
        <div style={{border:"2px solid #16181D",borderRadius:10,padding:14}}>
          {/* رأس البوليصة */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"2px solid #16181D",paddingBottom:10,marginBottom:12}}>
            <div>
              <div style={{fontWeight:900,fontSize:18}}>📦 {company}</div>
              <div style={{fontSize:10,color:"#6E7178"}}>شركة توصيل وشحن</div>
            </div>
            <div style={{textAlign:"left",fontSize:11,color:"#6E7178",fontFamily:"monospace"}}>
              <div>{shipment.date}</div>
              <div>{shipment.time}</div>
            </div>
          </div>
          {/* باركود */}
          <div style={{background:"#F8F9FA",borderRadius:8,padding:"10px 4px",marginBottom:12,border:"1px solid #dee2e6"}}>
            <Barcode value={shipment.tracking_code} width={320} height={50}/>
          </div>
          {/* رقم التتبع */}
          <div style={{textAlign:"center",marginBottom:12}}>
            <span style={{background:"#16181D",color:"#fff",fontFamily:"monospace",fontWeight:700,fontSize:14,padding:"4px 16px",borderRadius:6}}>{shipment.tracking_code}</span>
          </div>
          {/* بيانات */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            <div style={{background:"#F8F9FA",borderRadius:7,padding:9}}>
              <div style={{fontSize:10,color:"#6E7178",marginBottom:2}}>📦 المرسل</div>
              <div style={{fontWeight:700,fontSize:13}}>{shipment.sender}</div>
            </div>
            <div style={{background:"#E8F5E9",borderRadius:7,padding:9}}>
              <div style={{fontSize:10,color:"#6E7178",marginBottom:2}}>🏠 المستلم</div>
              <div style={{fontWeight:700,fontSize:13}}>{shipment.customer_name||"—"}</div>
              {shipment.customer_phone&&<div style={{fontSize:11,color:T.blue2}}>📞 {shipment.customer_phone}</div>}
            </div>
          </div>
          <div style={{background:"#F0F4FF",borderRadius:7,padding:9,marginBottom:10}}>
            <div style={{fontSize:10,color:"#6E7178",marginBottom:2}}>📍 عنوان التوصيل</div>
            <div style={{fontWeight:700,fontSize:13}}>{shipment.destination}</div>
            {shipment.customer_address&&<div style={{fontSize:11,color:"#555",marginTop:2}}>{shipment.customer_address}</div>}
          </div>
          <div style={{background:"#FFF9DB",borderRadius:7,padding:9,marginBottom:10,fontSize:12,color:"#555"}}>
            📝 {shipment.package_type} — {shipment.description||"—"}
          </div>
          {/* المبلغ */}
          <div style={{background:"#16181D",color:"#fff",borderRadius:8,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:11,opacity:.7}}>{shipment.payment_type}</div>
              <div style={{fontSize:11,opacity:.7}}>المبلغ المطلوب تحصيله</div>
            </div>
            <div style={{textAlign:"left"}}>
              {shipment.discount>0&&<div style={{fontSize:10,textDecoration:"line-through",opacity:.6}}>{shipment.price} د.ل</div>}
              <div style={{fontFamily:"monospace",fontWeight:900,fontSize:20}}>{shipment.final_price||shipment.price} د.ل</div>
            </div>
          </div>
          {shipment.driver_name&&<div style={{textAlign:"center",marginTop:8,fontSize:11,color:"#6E7178"}}>🧑‍💼 المندوب: <strong>{shipment.driver_name}</strong></div>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ➕ نموذج إضافة شحنة
// ══════════════════════════════════════════════
function AddShipmentModal({drivers, onSave, onClose}) {
  const [form, setForm] = useState({
    customer_name:"", customer_phone:"", customer_address:"",
    package_type:"طرود عامة", description:"", weight:"1",
    sender:"", destination:"", area:"",
    price:"", discount:"0", payment_type:"COD",
    driver_id:"", note:"",
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const finalPrice = calcFinal(Number(form.price)||0, Number(form.discount)||0);

  const save = () => {
    if(!form.sender||!form.destination) { alert("المرسل والوجهة مطلوبان"); return; }
    const code = genCode();
    const driver = drivers.find(d=>d.id===Number(form.driver_id));
    onSave({
      tracking_code: code,
      customer_name: form.customer_name||null,
      customer_phone: form.customer_phone||null,
      customer_address: form.customer_address||null,
      package_type: form.package_type,
      description: form.description||null,
      weight: Number(form.weight)||1,
      sender: form.sender,
      destination: form.destination,
      area: form.area||null,
      price: Number(form.price)||0,
      discount: Number(form.discount)||0,
      final_price: finalPrice,
      cod_amount: form.payment_type==="COD"?finalPrice:0,
      payment_type: form.payment_type,
      driver_id: form.driver_id?Number(form.driver_id):null,
      driver_name: driver?.name||null,
      note: form.note||"",
      status: "جديدة",
      source: "manual",
      date: todayDate(),
      time: nowTime(),
    });
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:700,padding:16,overflowY:"auto"}}>
      <div style={{background:T.card,borderRadius:16,padding:22,width:"100%",maxWidth:560,direction:"rtl",border:`1px solid ${T.border}`,margin:"20px auto",boxShadow:T.shadow2}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:800,color:T.text}}>➕ شحنة جديدة</h3>
          <button onClick={onClose} style={{background:T.bg2,border:"none",borderRadius:8,width:30,height:30,color:T.muted,cursor:"pointer",fontSize:14}}>✕</button>
        </div>

        {/* بيانات المستلم */}
        <div style={{background:T.bg2,borderRadius:10,padding:14,marginBottom:12,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:12,color:T.muted,fontWeight:700,marginBottom:10}}>👤 بيانات المستلم</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>الاسم</div><Inp value={form.customer_name} onChange={v=>set("customer_name",v)} placeholder="اسم المستلم"/></div>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>الهاتف</div><Inp value={form.customer_phone} onChange={v=>set("customer_phone",v)} placeholder="218XXXXXXXXX"/></div>
          </div>
          <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>العنوان التفصيلي</div><Inp value={form.customer_address} onChange={v=>set("customer_address",v)} placeholder="الشارع، الحي، العلامة المميزة"/></div>
        </div>

        {/* بيانات الشحنة */}
        <div style={{background:T.bg2,borderRadius:10,padding:14,marginBottom:12,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:12,color:T.muted,fontWeight:700,marginBottom:10}}>📦 بيانات الشحنة</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:4}}>نوع الشحنة</div>
              <Sel value={form.package_type} onChange={v=>set("package_type",v)}>
                {Object.keys(TYPE_ICON).map(t=><option key={t}>{t}</option>)}
              </Sel>
            </div>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>الوزن (كغ)</div><Inp value={form.weight} onChange={v=>set("weight",v)} type="number" placeholder="1"/></div>
          </div>
          <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>وصف المحتوى</div><Inp value={form.description} onChange={v=>set("description",v)} placeholder="لون، مقاس، وصف مختصر"/></div>
        </div>

        {/* المرسل والوجهة */}
        <div style={{background:T.bg2,borderRadius:10,padding:14,marginBottom:12,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:12,color:T.muted,fontWeight:700,marginBottom:10}}>📍 المرسل والوجهة</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>من (المرسل) *</div><Inp value={form.sender} onChange={v=>set("sender",v)} placeholder="اسم المحل أو الشخص"/></div>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>إلى (الوجهة) *</div><Inp value={form.destination} onChange={v=>set("destination",v)} placeholder="الحي، المنطقة"/></div>
          </div>
        </div>

        {/* المالية */}
        <div style={{background:T.bg2,borderRadius:10,padding:14,marginBottom:12,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:12,color:T.muted,fontWeight:700,marginBottom:10}}>💰 المالية</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>السعر (د.ل)</div><Inp value={form.price} onChange={v=>set("price",v)} type="number" placeholder="0"/></div>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>الخصم (%)</div><Inp value={form.discount} onChange={v=>set("discount",v)} type="number" placeholder="0"/></div>
            <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
              <div style={{background:T.green+"22",borderRadius:8,padding:"8px 10px",border:`1px solid ${T.green}44`}}>
                <div style={{fontSize:10,color:T.muted}}>السعر النهائي</div>
                <div style={{fontWeight:900,color:T.green,fontSize:16,fontFamily:"monospace"}}>{finalPrice} د.ل</div>
              </div>
            </div>
          </div>
          <div>
            <div style={{fontSize:11,color:T.muted,marginBottom:4}}>طريقة الدفع</div>
            <Sel value={form.payment_type} onChange={v=>set("payment_type",v)}>
              <option value="COD">تحصيل عند التسليم (COD)</option>
              <option value="مدفوع مقدم">مدفوع مقدماً</option>
            </Sel>
          </div>
        </div>

        {/* المندوب والملاحظة */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          <div>
            <div style={{fontSize:11,color:T.muted,marginBottom:4}}>🧑‍💼 تعيين مندوب</div>
            <Sel value={form.driver_id} onChange={v=>set("driver_id",v)}>
              <option value="">بدون تعيين</option>
              {drivers.filter(d=>d.is_active).map(d=><option key={d.id} value={d.id}>{d.name} ({d.status})</option>)}
            </Sel>
          </div>
          <div>
            <div style={{fontSize:11,color:T.muted,marginBottom:4}}>📋 ملاحظة</div>
            <Inp value={form.note} onChange={v=>set("note",v)} placeholder="ملاحظة اختيارية"/>
          </div>
        </div>

        <div style={{display:"flex",gap:8}}>
          <Btn onClick={save} style={{flex:1}}>💾 حفظ الشحنة</Btn>
          <Btn onClick={onClose} color={T.bg2} style={{border:`1px solid ${T.border}`,color:T.text}}>إلغاء</Btn>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  📦 بطاقة الشحنة
// ══════════════════════════════════════════════
function ShipmentCard({s, drivers, onUpdate, onPrint, settings}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(s.note||"");
  const isUrgent = s.status==="عاجلة";
  const isReview = s.status==="يحتاج مراجعة";

  return(
    <div style={{background:T.card,borderRadius:12,marginBottom:8,overflow:"hidden",border:`1.5px solid ${isUrgent?T.red:isReview?T.orange:open?T.blue:T.border}`,transition:"border-color .2s"}}>
      {isUrgent&&<div style={{height:3,background:`linear-gradient(90deg,${T.red},${T.orange})`}}/>}

      {/* ROW */}
      <div onClick={()=>setOpen(!open)} style={{padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:38,height:38,borderRadius:9,background:isUrgent?"#2D0A0A":T.blue3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>
          {isUrgent?"🚨":isReview?"⚠️":TYPE_ICON[s.package_type]||"📦"}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <span style={{fontWeight:700,fontSize:13,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:120}}>{s.customer_name||s.sender}</span>
            <span style={{color:T.muted,fontSize:11,fontFamily:"monospace"}}>{s.tracking_code}</span>
            {s.discount>0&&<span style={{background:T.green+"22",color:T.green,fontSize:10,padding:"1px 6px",borderRadius:8,fontWeight:700}}>-{s.discount}%</span>}
          </div>
          <div style={{color:T.muted,fontSize:11,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {s.package_type} • {s.destination} {s.driver_name?`• 🧑‍💼 ${s.driver_name}`:""}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
          <Badge status={s.status}/>
          <span style={{color:T.yellow,fontWeight:800,fontSize:13,fontFamily:"monospace"}}>{fmtNum(s.final_price||s.price)} د.ل</span>
        </div>
        <span style={{color:T.muted,fontSize:10,transform:open?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▼</span>
      </div>

      {/* DETAILS */}
      {open&&(
        <div style={{borderTop:`1px solid ${T.border}`,background:T.bg,padding:14}}>
          {/* Grid معلومات */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
            {[
              ["👤 الزبون", s.customer_name||"—", T.text],
              ["📞 الهاتف", s.customer_phone||"—", T.blue],
              ["📦 المرسل", s.sender, T.text],
              ["🏠 الوجهة", s.destination, T.text],
              ["💰 السعر", `${fmtNum(s.price)} د.ل`, T.text],
              ["💚 بعد الخصم", `${fmtNum(s.final_price||s.price)} د.ل`, T.green],
              ["💳 الدفع", s.payment_type, s.payment_type==="COD"?T.orange:T.green],
              ["📅 التاريخ", `${fmtDate(s.date)} ${s.time||""}`, T.muted],
              ["🧑‍💼 المندوب", s.driver_name||"غير معين", T.text],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:T.card,borderRadius:8,padding:"8px 10px",border:`1px solid ${T.border}`}}>
                <div style={{fontSize:10,color:T.muted,marginBottom:2}}>{l}</div>
                <div style={{fontSize:12,fontWeight:600,color:c,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div>
              </div>
            ))}
          </div>

          {s.description&&<div style={{background:T.card,borderRadius:8,padding:"8px 10px",marginBottom:10,fontSize:12,color:T.muted,border:`1px solid ${T.border}`}}>📝 {s.description}</div>}
          {s.customer_address&&<div style={{background:T.card,borderRadius:8,padding:"8px 10px",marginBottom:10,fontSize:12,color:T.muted,border:`1px solid ${T.border}`}}>📍 {s.customer_address}</div>}

          {/* تحديث الحالة */}
          {!["تم التسليم","ملغية"].includes(s.status)&&(
            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600}}>تحديث الحالة:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {["تم الاستلام","في الطريق","قريب من التسليم","تم التسليم","مؤجلة","مرتجعة","ملغية"]
                  .filter(st=>st!==s.status)
                  .map(st=>{
                    const c = STATUS_CONFIG[st]?.color||T.muted;
                    return(
                      <button key={st} onClick={()=>onUpdate(s.id,"status",st)}
                        style={{background:STATUS_CONFIG[st]?.bg||T.bg2,color:c,border:`1px solid ${c}44`,borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                        {st}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* تعيين مندوب */}
          {!["تم التسليم","ملغية"].includes(s.status)&&(
            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600}}>تعيين مندوب:</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {drivers.filter(d=>d.is_active).map(d=>(
                  <button key={d.id} onClick={()=>onUpdate(s.id,"driver",d)}
                    style={{background:s.driver_id===d.id?T.blue:T.card,color:s.driver_id===d.id?"#fff":T.muted,border:`1.5px solid ${s.driver_id===d.id?T.blue:T.border}`,borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                    🧑‍💼 {d.name}
                    <span style={{fontSize:9,marginRight:4,opacity:.7}}>({d.status})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ملاحظة */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>📋 ملاحظة داخلية</div>
            <div style={{display:"flex",gap:6}}>
              <Inp value={note} onChange={setNote} placeholder="ملاحظة للفريق..." style={{flex:1}}/>
              <Btn onClick={()=>onUpdate(s.id,"note",note)} color={T.blue2} style={{padding:"9px 14px",fontSize:12}}>حفظ</Btn>
            </div>
          </div>

          {/* أزرار */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <Btn onClick={()=>onPrint(s)} color={T.blue} style={{fontSize:12,padding:"7px 12px"}}>🖨️ طباعة</Btn>
            {s.customer_phone&&(
              <a href={`tel:${s.customer_phone}`} style={{background:T.card,border:`1px solid ${T.border}`,color:T.muted,borderRadius:9,padding:"7px 12px",fontSize:13,textDecoration:"none"}}>📞</a>
            )}
            {s.customer_phone&&(
              <a href={buildWA(s.customer_phone,`مرحباً ${s.customer_name||""}، شحنتك #${s.tracking_code} ${s.status}`)} target="_blank" rel="noreferrer"
                style={{background:"#064E3B",color:"#4ADE80",border:"1px solid #065F46",borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,textDecoration:"none"}}>📱 واتساب</a>
            )}
            {settings?.waGroupNumber&&(
              <a href={buildWA(settings.waGroupNumber,`📦 *${settings.companyName}*\nشحنة #${s.tracking_code}\n👤 ${s.customer_name||"—"}\n📍 ${s.destination}\n💰 ${s.final_price||s.price} د.ل\nالحالة: ${s.status}`)} target="_blank" rel="noreferrer"
                style={{background:"#064E3B",color:"#4ADE80",border:"1px solid #065F46",borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,textDecoration:"none"}}>📢 الجروب</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  💬 محادثات البوت
// ══════════════════════════════════════════════
function ConversationsPanel({onClose}) {
  const [convs, setConvs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    db.getConversations().then(d=>{setConvs(d);setLoading(false);});
  },[]);

  const msgs = selected?.messages||[];

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"stretch",justifyContent:"flex-end",zIndex:800}}>
      <div style={{width:"100%",maxWidth:540,background:T.card,display:"flex",flexDirection:"column",direction:"rtl",boxShadow:T.shadow2,border:`1px solid ${T.border}`}}>
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:T.blue2}}>
          <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>💬 محادثات البوت</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,width:30,height:30,color:"#fff",cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>
          {/* قائمة المحادثات */}
          <div style={{width:190,flexShrink:0,borderLeft:`1px solid ${T.border}`,overflowY:"auto",background:T.bg}}>
            {loading&&<div style={{padding:20,textAlign:"center",color:T.muted,fontSize:12}}>⏳ جاري التحميل...</div>}
            {!loading&&convs.length===0&&<div style={{padding:20,textAlign:"center",color:T.muted,fontSize:12}}>لا توجد محادثات</div>}
            {convs.map((c,i)=>(
              <div key={i} onClick={()=>setSelected(c)}
                style={{padding:"11px 12px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,background:selected===c?T.blue3:T.card,transition:"background .15s"}}>
                <div style={{fontWeight:700,fontSize:12,color:selected===c?T.blue:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  📱 {c.phone_number||"مجهول"}
                </div>
                <div style={{fontSize:10,color:T.muted,marginTop:2}}>{c.current_step||"—"}</div>
                <div style={{fontSize:10,color:T.muted,marginTop:2}}>
                  {c.last_message_at?new Date(c.last_message_at).toLocaleDateString("ar-LY",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—"}
                </div>
                {c.messages?.length>0&&<div style={{fontSize:10,color:T.blue,marginTop:2,fontWeight:600}}>{c.messages.length} رسالة</div>}
              </div>
            ))}
          </div>
          {/* المحادثة */}
          <div style={{flex:1,overflowY:"auto",background:"#ECE5DD",display:"flex",flexDirection:"column",gap:6,padding:10}}>
            {!selected&&<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:T.muted,fontSize:13}}>👈 اختر محادثة</div>}
            {selected&&msgs.length===0&&<div style={{textAlign:"center",color:T.muted,fontSize:12,padding:20}}>لا توجد رسائل</div>}
            {selected&&msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-start":"flex-end"}}>
                <div style={{maxWidth:"80%",background:m.role==="user"?"#fff":"#DCF8C6",borderRadius:m.role==="user"?"12px 12px 12px 3px":"12px 12px 3px 12px",padding:"8px 11px",boxShadow:"0 1px 2px rgba(0,0,0,0.1)"}}>
                  <div style={{fontSize:10,color:"#888",marginBottom:3,fontWeight:700}}>{m.role==="user"?"👤 الزبون":"🤖 البوت"}</div>
                  <div style={{fontSize:13,color:"#1a1a1a",whiteSpace:"pre-wrap",lineHeight:1.5}}>{m.content}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  👥 إدارة المناديب
// ══════════════════════════════════════════════
function DriversPage({drivers, onRefresh, shipments}) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({name:"",phone:"",pin:"0000",area:""});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const addDriver = async () => {
    if(!form.name||!form.phone){alert("الاسم والهاتف مطلوبان");return;}
    await db.insertDriver({...form,status:"متاح",is_active:true});
    setShowAdd(false); setForm({name:"",phone:"",pin:"0000",area:""});
    onRefresh();
  };

  const driverStats = (driverId) => {
    const dShips = shipments.filter(s=>s.driver_id===driverId);
    const delivered = dShips.filter(s=>s.status==="تم التسليم");
    const revenue = delivered.reduce((sum,s)=>sum+Number(s.final_price||s.price),0);
    const active = dShips.filter(s=>["في الطريق","قريب من التسليم","تم الاستلام"].includes(s.status)).length;
    return {total:dShips.length, delivered:delivered.length, revenue, active};
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:T.text}}>👥 المناديب</div>
          <div style={{fontSize:12,color:T.muted}}>{drivers.length} مندوب مسجل</div>
        </div>
        <Btn onClick={()=>setShowAdd(true)}>+ إضافة مندوب</Btn>
      </div>

      {showAdd&&(
        <div style={{background:T.card,borderRadius:12,padding:16,marginBottom:16,border:`1px solid ${T.blue}`}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>➕ مندوب جديد</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>الاسم *</div><Inp value={form.name} onChange={v=>set("name",v)} placeholder="اسم المندوب"/></div>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>الهاتف *</div><Inp value={form.phone} onChange={v=>set("phone",v)} placeholder="218XXXXXXXXX"/></div>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>رمز الدخول (PIN)</div><Inp value={form.pin} onChange={v=>set("pin",v)} placeholder="0000" type="password"/></div>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>المنطقة</div><Inp value={form.area} onChange={v=>set("area",v)} placeholder="المنطقة التي يغطيها"/></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={addDriver} color={T.green}>💾 حفظ</Btn>
            <Btn onClick={()=>setShowAdd(false)} color={T.bg2} style={{border:`1px solid ${T.border}`,color:T.text}}>إلغاء</Btn>
          </div>
        </div>
      )}

      <div style={{display:"grid",gap:10}}>
        {drivers.map(d=>{
          const stats = driverStats(d.id);
          const statusColor = d.status==="متاح"?T.green:d.status==="مشغول"?T.orange:T.muted;
          return(
            <div key={d.id} style={{background:T.card,borderRadius:12,padding:16,border:`1px solid ${T.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:46,height:46,borderRadius:"50%",background:d.status==="متاح"?T.greenD:d.status==="مشغول"?"#2D1A07":T.bg2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,border:`2px solid ${statusColor}`}}>🧑‍💼</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontWeight:800,fontSize:14,color:T.text}}>{d.name}</span>
                    <span style={{background:statusColor+"22",color:statusColor,border:`1px solid ${statusColor}44`,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>{d.status}</span>
                    {d.area&&<span style={{fontSize:11,color:T.muted}}>📍 {d.area}</span>}
                  </div>
                  <div style={{fontSize:12,color:T.muted,marginTop:3}}>
                    📞 {d.phone} • {stats.total} شحنة • {stats.delivered} تسليم
                    {stats.active>0&&<span style={{color:T.orange}}> • {stats.active} جارية</span>}
                  </div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:16,fontWeight:900,color:T.yellow,fontFamily:"monospace"}}>{fmtNum(stats.revenue)}</div>
                  <div style={{fontSize:10,color:T.muted}}>د.ل إيرادات</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <Sel value={d.status} onChange={v=>db.updateDriver(d.id,{status:v}).then(onRefresh)} style={{width:110,fontSize:11,padding:"6px 8px"}}>
                    <option>متاح</option><option>مشغول</option><option>أوفلاين</option>
                  </Sel>
                  <a href={buildWA(d.phone,"")} target="_blank" rel="noreferrer"
                    style={{background:"#25D366",color:"#fff",borderRadius:8,padding:"6px 10px",fontSize:13,fontWeight:700,textDecoration:"none"}}>📱</a>
                </div>
              </div>
            </div>
          );
        })}
        {drivers.length===0&&<div style={{textAlign:"center",color:T.muted,padding:30,fontSize:14}}>لا يوجد مناديب مسجلون</div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  📊 الإحصائيات
// ══════════════════════════════════════════════
function StatsPage({shipments, drivers, driverComm}) {
  const done    = shipments.filter(s=>s.status==="تم التسليم");
  const revenue = done.reduce((sum,s)=>sum+Number(s.final_price||s.price),0);
  const cod     = shipments.filter(s=>s.payment_type==="COD"&&s.status!=="ملغية"&&s.status!=="مرتجعة").reduce((sum,s)=>sum+Number(s.final_price||s.price),0);

  const last7 = Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-i);
    const ds=d.toISOString().split("T")[0];
    return {date:d.toLocaleDateString("ar-LY",{day:"2-digit",month:"short"}), count:shipments.filter(s=>s.date===ds).length};
  }).reverse();
  const maxC = Math.max(...last7.map(d=>d.count),1);

  const dStats = drivers.map(d=>{
    const dShips = shipments.filter(s=>s.driver_id===d.id&&s.status==="تم التسليم");
    const rev = dShips.reduce((sum,s)=>sum+Number(s.final_price||s.price),0);
    return {...d, delivered:dShips.length, revenue:rev, share:Math.round(rev*driverComm)};
  }).sort((a,b)=>b.delivered-a.delivered);

  const byStatus = Object.keys(STATUS_CONFIG).map(st=>({
    status:st, count:shipments.filter(s=>s.status===st).length
  })).filter(s=>s.count>0).sort((a,b)=>b.count-a.count);

  return(
    <div style={{display:"grid",gap:12}}>
      {/* بطاقات رئيسية */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        <Stat icon="📦" label="إجمالي الشحنات" value={shipments.length} color={T.blue}/>
        <Stat icon="✅" label="تم التسليم" value={done.length} color={T.green} sub={`${shipments.length>0?Math.round(done.length/shipments.length*100):0}% معدل التسليم`}/>
        <Stat icon="💰" label="الإيرادات المحصلة" value={`${fmtNum(revenue)} د.ل`} color={T.yellow}/>
        <Stat icon="💳" label="COD المتوقع" value={`${fmtNum(cod)} د.ل`} color={T.cyan}/>
      </div>

      {/* رسم بياني */}
      <div style={{background:T.card,borderRadius:12,padding:16,border:`1px solid ${T.border}`}}>
        <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:14}}>📈 الشحنات آخر 7 أيام</div>
        <div style={{display:"flex",gap:6,alignItems:"flex-end",height:90}}>
          {last7.map((d,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:11,color:T.blue,fontWeight:700}}>{d.count||""}</div>
              <div style={{width:"100%",background:d.count>0?T.blue:T.border,borderRadius:"4px 4px 0 0",height:`${(d.count/maxC)*70}px`,minHeight:d.count>0?8:2,transition:"height .5s"}}/>
              <div style={{fontSize:9,color:T.muted,textAlign:"center"}}>{d.date}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {/* توزيع الحالات */}
        <div style={{background:T.card,borderRadius:12,padding:16,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:12}}>📊 توزيع الحالات</div>
          {byStatus.map(({status,count})=>{
            const sc = STATUS_CONFIG[status];
            const pct = Math.round(count/shipments.length*100);
            return(
              <div key={status} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                  <span style={{color:sc?.color||T.muted}}>{status}</span>
                  <span style={{color:T.muted}}>{count} ({pct}%)</span>
                </div>
                <div style={{background:T.border,borderRadius:4,height:6}}>
                  <div style={{background:sc?.color||T.muted,height:"100%",width:`${pct}%`,borderRadius:4,transition:"width .6s"}}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* أداء المناديب */}
        <div style={{background:T.card,borderRadius:12,padding:16,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:12}}>🏆 أداء المناديب</div>
          {dStats.filter(d=>d.delivered>0).map((d,i)=>(
            <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"8px 10px",background:T.bg,borderRadius:9,border:`1px solid ${T.border}`}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:T.blue3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:T.blue,flexShrink:0}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:T.text}}>{d.name}</div>
                <div style={{fontSize:11,color:T.muted}}>{d.delivered} تسليم</div>
              </div>
              <div style={{textAlign:"left"}}>
                <div style={{fontSize:13,fontWeight:800,color:T.yellow,fontFamily:"monospace"}}>{fmtNum(d.share)} د.ل</div>
                <div style={{fontSize:10,color:T.muted}}>حصته</div>
              </div>
            </div>
          ))}
          {dStats.filter(d=>d.delivered>0).length===0&&<div style={{color:T.muted,fontSize:12,textAlign:"center",padding:20}}>لا توجد بيانات</div>}

          {/* توزيع الإيرادات */}
          <div style={{background:T.blue3,borderRadius:9,padding:12,marginTop:12}}>
            <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:8}}>💰 توزيع الإيرادات</div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
              <div><div style={{color:T.muted,fontSize:10}}>المناديب ({Math.round(driverComm*100)}%)</div><div style={{color:T.green,fontWeight:800,fontFamily:"monospace"}}>{fmtNum(Math.round(revenue*driverComm))} د.ل</div></div>
              <div><div style={{color:T.muted,fontSize:10}}>الشركة ({100-Math.round(driverComm*100)}%)</div><div style={{color:T.blue,fontWeight:800,fontFamily:"monospace"}}>{fmtNum(Math.round(revenue*(1-driverComm)))} د.ل</div></div>
              <div><div style={{color:T.muted,fontSize:10}}>الإجمالي</div><div style={{color:T.yellow,fontWeight:800,fontFamily:"monospace"}}>{fmtNum(revenue)} د.ل</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ⚙️ الإعدادات
// ══════════════════════════════════════════════
function SettingsPage({settings, onSave, driverComm, onCommChange, onBack}) {
  const [local, setLocal] = useState({...settings});
  const [localComm, setLocalComm] = useState(driverComm);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("company");
  const set = (k,v) => setLocal(s=>({...s,[k]:v}));

  const save = async () => {
    await onSave({...local, driverComm:String(localComm), ...(window.__KHOTWA_PIN?{adminPin:window.__KHOTWA_PIN}:{})});
    onCommChange(localComm);
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  const changePin = () => {
    if(newPin.length!==4){setPinMsg("❌ الرمز 4 أرقام");return;}
    if(newPin!==confirmPin){setPinMsg("❌ الرمزان غير متطابقين");return;}
    window.__KHOTWA_PIN = newPin;
    setNewPin(""); setConfirmPin("");
    setPinMsg("✅ تم تغيير الرمز!");
    setTimeout(()=>setPinMsg(""),3000);
  };

  const tabs = [{id:"company",icon:"🏢",label:"الشركة"},{id:"pricing",icon:"💰",label:"المالية"},{id:"integrations",icon:"🔗",label:"التكامل"},{id:"security",icon:"🔐",label:"الأمان"}];

  return(
    <div style={{minHeight:"100vh",background:T.bg,direction:"rtl",color:T.text}}>
      <div style={{background:T.blue2,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:54,position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,padding:"7px 12px",color:"#fff",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:700}}>← رجوع</button>
          <span style={{fontWeight:800,fontSize:15,color:"#fff"}}>⚙️ الإعدادات</span>
        </div>
        <button onClick={save} style={{background:saved?"#fff":T.blue3,color:saved?T.green:"#fff",border:"none",borderRadius:9,padding:"8px 18px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
          {saved?"✅ تم!":"💾 حفظ الكل"}
        </button>
      </div>
      <div style={{display:"flex",maxWidth:800,margin:"0 auto"}}>
        <div style={{width:130,flexShrink:0,padding:"12px 0",borderLeft:`1px solid ${T.border}`,minHeight:"calc(100vh - 54px)",background:T.card}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"11px 14px",fontSize:13,fontWeight:700,color:tab===t.id?T.blue:T.muted,background:tab===t.id?T.blue3:"transparent",border:"none",borderRight:tab===t.id?`3px solid ${T.blue}`:"3px solid transparent",cursor:"pointer",fontFamily:"inherit"}}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
        <div style={{flex:1,padding:"20px 16px",maxWidth:600}}>
          {tab==="company"&&(
            <div>
              <div style={{fontSize:15,fontWeight:800,marginBottom:14}}>🏢 بيانات الشركة</div>
              <div style={{display:"grid",gap:12}}>
                {[["اسم الشركة","companyName"],["شعار الشركة","companySlogan"],["رقم واتساب الجروب","waGroupNumber"],["رقم واتساب الإدارة","adminPhone"]].map(([lb,k])=>(
                  <div key={k}>
                    <div style={{fontSize:11,color:T.muted,marginBottom:5,fontWeight:600}}>{lb}</div>
                    <Inp value={local[k]||""} onChange={v=>set(k,v)} placeholder={lb}/>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab==="pricing"&&(
            <div>
              <div style={{fontSize:15,fontWeight:800,marginBottom:14}}>💰 المالية ونسبة المندوب</div>
              <div style={{background:T.card,borderRadius:12,padding:16,border:`1px solid ${T.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:8}}>
                  <span>حصة المندوب</span><span style={{color:T.green,fontWeight:800}}>{Math.round(localComm*100)}%</span>
                </div>
                <input type="range" min="10" max="90" step="5" value={Math.round(localComm*100)} onChange={e=>setLocalComm(Number(e.target.value)/100)} style={{width:"100%",accentColor:T.blue,marginBottom:8}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:12}}>
                  <span>حصة الشركة</span><span style={{color:T.blue,fontWeight:800}}>{100-Math.round(localComm*100)}%</span>
                </div>
                <div style={{background:T.bg,borderRadius:9,padding:12,fontSize:12,color:T.muted}}>
                  مثال طلب 30 د.ل: المندوب <strong style={{color:T.green}}>{Math.round(30*localComm)} د.ل</strong> • الشركة <strong style={{color:T.blue}}>{Math.round(30*(1-localComm))} د.ل</strong>
                </div>
              </div>
            </div>
          )}
          {tab==="integrations"&&(
            <div>
              <div style={{fontSize:15,fontWeight:800,marginBottom:14}}>🔗 التكامل</div>
              <div style={{background:T.card,borderRadius:12,padding:16,border:`1px solid ${T.border}`}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>✈️ تيليغرام</div>
                {[["Bot Token","tgToken"],["Chat ID","tgChatId"]].map(([lb,k])=>(
                  <div key={k} style={{marginBottom:12}}>
                    <div style={{fontSize:11,color:T.muted,marginBottom:5,fontWeight:600}}>{lb}</div>
                    <Inp value={local[k]||""} onChange={v=>set(k,v)} placeholder={lb}/>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab==="security"&&(
            <div>
              <div style={{fontSize:15,fontWeight:800,marginBottom:14}}>🔐 الأمان</div>
              <div style={{background:T.card,borderRadius:12,padding:16,border:`1px solid ${T.border}`}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>🔑 تغيير رمز الإدارة</div>
                <div style={{display:"grid",gap:12}}>
                  <div><div style={{fontSize:11,color:T.muted,marginBottom:5}}>الرمز الجديد (4 أرقام)</div><Inp value={newPin} onChange={v=>setNewPin(v.replace(/[^0-9]/g,"").slice(0,4))} type="password" placeholder="••••"/></div>
                  <div><div style={{fontSize:11,color:T.muted,marginBottom:5}}>تأكيد الرمز</div><Inp value={confirmPin} onChange={v=>setConfirmPin(v.replace(/[^0-9]/g,"").slice(0,4))} type="password" placeholder="••••"/></div>
                  <Btn onClick={changePin} color={T.blue}>🔐 تغيير الرمز</Btn>
                  {pinMsg&&<div style={{fontSize:13,color:pinMsg.includes("✅")?T.green:T.red,textAlign:"center",fontWeight:600}}>{pinMsg}</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  🔐 صفحة الدخول
// ══════════════════════════════════════════════
function LoginPage({onLogin, company}) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [tries, setTries] = useState(0);

  const tryLogin = () => {
    const cp = window.__KHOTWA_PIN||"1234";
    if(pin===cp){ onLogin(); }
    else { setShake(true); setPin(""); setTries(t=>t+1); setTimeout(()=>setShake(false),500); }
  };
  const press = v => {
    if(v==="⌫") setPin(p=>p.slice(0,-1));
    else if(v==="✓") tryLogin();
    else if(pin.length<4) setPin(p=>p+v);
  };
  useEffect(()=>{ if(pin.length===4) tryLogin(); },[pin]);

  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${T.bg} 0%,${T.bg2} 50%,${T.bg} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",direction:"rtl",fontFamily:"inherit"}}>
      <div style={{background:T.card,borderRadius:24,padding:"40px 32px",width:300,textAlign:"center",boxShadow:T.shadow2,border:`1px solid ${T.border}`}}>
        <div style={{width:64,height:64,borderRadius:20,background:T.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 14px"}}>📦</div>
        <h2 style={{color:T.text,margin:"0 0 4px",fontSize:22,fontWeight:900}}>{company||"خُطوة"}</h2>
        <p style={{color:T.muted,fontSize:12,margin:"0 0 24px"}}>لوحة التحكم</p>
        <div style={{display:"flex",justifyContent:"center",gap:14,marginBottom:26}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:12,height:12,borderRadius:"50%",background:i<pin.length?T.blue:"transparent",border:`2px solid ${i<pin.length?T.blue:T.border}`,transition:"all .2s"}}/>)}
        </div>
        <div style={{animation:shake?"shake .4s":"none"}}>
          {[["1","2","3"],["4","5","6"],["7","8","9"],["⌫","0","✓"]].map((row,ri)=>(
            <div key={ri} style={{display:"flex",gap:8,justifyContent:"center",marginBottom:8}}>
              {row.map(v=>(
                <button key={v} onClick={()=>press(v)}
                  style={{width:72,height:52,borderRadius:12,border:`1.5px solid ${v==="✓"?T.blue:T.border}`,background:v==="✓"?T.blue:T.card2,color:v==="✓"?"#fff":T.text,fontSize:v==="⌫"||v==="✓"?18:20,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
                  {v}
                </button>
              ))}
            </div>
          ))}
        </div>
        {tries>0&&<p style={{color:T.red,fontSize:12,marginTop:12,fontWeight:600}}>❌ رمز خاطئ ({tries} محاولة)</p>}
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════
//  📱 تطبيق المندوب
// ══════════════════════════════════════════════
function DriverApp() {
  const [step, setStep] = useState("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [driver, setDriver] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [filter, setFilter] = useState("الكل");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const login = async () => {
    if(!phone||!pin){setLoginError("أدخل الهاتف والرمز");return;}
    setLoading(true);
    const d = await db.getDriverByPhone(phone, pin);
    if(d){ setDriver(d); setStep("home"); loadShipments(d.id); }
    else setLoginError("رقم الهاتف أو الرمز غير صحيح");
    setLoading(false);
  };

  const loadShipments = async (driverId) => {
    const data = await db.getShipments({driver_id:driverId});
    setShipments(data);
  };

  const updateStatus = async (id, status) => {
    await db.updateShipment(id, {status});
    setShipments(prev=>prev.map(s=>s.id===id?{...s,status}:s));
  };

  if(step==="login") return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,direction:"rtl",fontFamily:"inherit"}}>
      <div style={{width:56,height:56,borderRadius:16,background:T.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:12}}>📦</div>
      <h2 style={{color:T.text,margin:"0 0 4px",fontSize:20,fontWeight:900}}>تطبيق المندوب</h2>
      <p style={{color:T.muted,fontSize:12,margin:"0 0 24px"}}>سجّل دخولك للوصول لشحناتك</p>
      <div style={{width:"100%",maxWidth:340,background:T.card,borderRadius:16,padding:20,border:`1px solid ${T.border}`}}>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:T.muted,marginBottom:5,fontWeight:600}}>رقم الهاتف</div>
          <Inp value={phone} onChange={setPhone} placeholder="218XXXXXXXXX"/>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:T.muted,marginBottom:5,fontWeight:600}}>رمز الدخول (PIN)</div>
          <Inp value={pin} onChange={setPin} type="password" placeholder="••••"/>
        </div>
        {loginError&&<div style={{color:T.red,fontSize:12,marginBottom:10,textAlign:"center"}}>{loginError}</div>}
        <Btn onClick={login} style={{width:"100%"}} disabled={loading}>{loading?"⏳ جاري...":"دخول ←"}</Btn>
      </div>
    </div>
  );

  const filters = ["الكل","في الطريق","تم الاستلام","قريب من التسليم","تم التسليم","مؤجلة","مرتجعة"];
  const filtered = filter==="الكل"?shipments:shipments.filter(s=>s.status===filter);
  const stats = {
    total:shipments.length,
    active:shipments.filter(s=>["في الطريق","تم الاستلام","قريب من التسليم"].includes(s.status)).length,
    done:shipments.filter(s=>s.status==="تم التسليم").length,
    cod:shipments.filter(s=>s.payment_type==="COD"&&s.status==="تم التسليم").reduce((sum,s)=>sum+Number(s.final_price||s.price),0),
  };

  return(
    <div style={{minHeight:"100vh",background:T.bg,direction:"rtl",fontFamily:"inherit",color:T.text,paddingBottom:20}}>
      {/* HEADER */}
      <div style={{background:T.card,borderBottom:`1px solid ${T.border}`,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,borderRadius:10,background:T.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🧑‍💼</div>
          <div>
            <div style={{fontWeight:800,fontSize:14}}>مرحباً، {driver?.name}</div>
            <div style={{fontSize:11,color:T.muted}}>واجهة المندوب</div>
          </div>
        </div>
        <button onClick={()=>{setDriver(null);setStep("login");}} style={{background:T.bg2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:9,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>خروج</button>
      </div>

      <div style={{padding:"14px 14px 0"}}>
        {/* إحصائيات */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
          {[["📦",stats.total,"إجمالي",T.blue],["⚡",stats.active,"جارية",T.orange],["✅",stats.done,"تسليم",T.green],["💰",`${fmtNum(stats.cod)}`,T.yellow]].map(([ic,val,lb,c])=>(
            <div key={lb} style={{background:T.card,borderRadius:10,padding:"10px 8px",border:`1px solid ${T.border}`,textAlign:"center",borderTop:`2px solid ${c}`}}>
              <div style={{fontSize:15}}>{ic}</div>
              <div style={{fontSize:16,fontWeight:900,color:c,margin:"2px 0"}}>{val}</div>
              <div style={{fontSize:9,color:T.muted}}>{lb}</div>
            </div>
          ))}
        </div>

        {/* فلاتر */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:12}}>
          {filters.map(f=>{
            const sc = STATUS_CONFIG[f];
            const cnt = f==="الكل"?shipments.length:shipments.filter(s=>s.status===f).length;
            return(
              <button key={f} onClick={()=>setFilter(f)}
                style={{background:filter===f?(sc?.color||T.blue):T.card,color:filter===f?"#fff":T.muted,border:`1px solid ${filter===f?(sc?.color||T.blue):T.border}`,borderRadius:18,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>
                {f}{cnt>0?` (${cnt})`:""}
              </button>
            );
          })}
        </div>

        {/* الشحنات */}
        {filtered.length===0&&<div style={{textAlign:"center",color:T.muted,padding:"40px 0",fontSize:14}}>📭 لا توجد شحنات</div>}
        {filtered.map(s=>(
          <div key={s.id} style={{background:T.card,borderRadius:12,marginBottom:8,padding:14,border:`1.5px solid ${s.status==="عاجلة"?T.red:T.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontWeight:800,fontSize:14,color:T.text}}>{s.customer_name||"—"}</div>
                <div style={{fontSize:11,color:T.muted,fontFamily:"monospace",marginTop:2}}>{s.tracking_code}</div>
              </div>
              <Badge status={s.status}/>
            </div>
            <div style={{fontSize:12,color:T.muted,marginBottom:8}}>
              📍 {s.destination}
              {s.customer_address&&<span> — {s.customer_address}</span>}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div>
                <div style={{fontSize:10,color:T.muted}}>{s.payment_type}</div>
                <div style={{fontWeight:900,color:T.yellow,fontSize:16,fontFamily:"monospace"}}>{fmtNum(s.final_price||s.price)} د.ل</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {s.customer_phone&&<a href={`tel:${s.customer_phone}`} style={{background:T.blue,color:"#fff",borderRadius:8,padding:"7px 12px",fontSize:13,textDecoration:"none"}}>📞</a>}
                {s.customer_phone&&<a href={buildWA(s.customer_phone,`مرحباً ${s.customer_name||""}، شحنتك #${s.tracking_code} ${s.status}`)} target="_blank" rel="noreferrer" style={{background:"#25D366",color:"#fff",borderRadius:8,padding:"7px 12px",fontSize:13,textDecoration:"none"}}>📱</a>}
              </div>
            </div>
            {!["تم التسليم","ملغية","مرتجعة"].includes(s.status)&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {s.status!=="تم الاستلام"&&<button onClick={()=>updateStatus(s.id,"تم الاستلام")} style={{background:T.cyan+"22",color:T.cyan,border:`1px solid ${T.cyan}44`,borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>تم الاستلام ✓</button>}
                {s.status!=="في الطريق"&&<button onClick={()=>updateStatus(s.id,"في الطريق")} style={{background:T.orange+"22",color:T.orange,border:`1px solid ${T.orange}44`,borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>في الطريق 🚗</button>}
                <button onClick={()=>updateStatus(s.id,"تم التسليم")} style={{background:T.green,color:"#fff",border:"none",borderRadius:7,padding:"6px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>✅ تم التسليم</button>
                <button onClick={()=>updateStatus(s.id,"مؤجلة")} style={{background:T.yellow+"22",color:T.yellow,border:`1px solid ${T.yellow}44`,borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>مؤجل ⏳</button>
                <button onClick={()=>updateStatus(s.id,"مرتجعة")} style={{background:T.red+"22",color:T.red,border:`1px solid ${T.red}44`,borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>مرتجع ↩️</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  📊 DASHBOARD الرئيسي
// ══════════════════════════════════════════════
function Dashboard({shipments, drivers, settings, onUpdate, onAddShipment, onLogout, dbStatus, driverComm, onOpenSettings, onRefreshDrivers, showToast}) {
  const [tab, setTab] = useState("shipments");
  const [filter, setFilter] = useState("الكل");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("الكل");
  const [printShipment, setPrintShipment] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showConvs, setShowConvs] = useState(false);

  const FILTERS = ["الكل","عاجلة","يحتاج مراجعة","جديدة","تم الاستلام","في الطريق","قريب من التسليم","تم التسليم","مؤجلة","مرتجعة","ملغية"];

  const dateFiltered = dateFilter==="اليوم"
    ? shipments.filter(s=>s.date===todayDate())
    : dateFilter==="الأسبوع"
    ? shipments.filter(s=>{const d=new Date(s.date);const w=new Date();w.setDate(w.getDate()-7);return d>=w;})
    : shipments;

  const filtered = dateFiltered.filter(s=>{
    const mf = filter==="الكل"||s.status===filter;
    const ms = !search||
      (s.customer_name||"").includes(search)||
      s.tracking_code.includes(search.toUpperCase())||
      (s.customer_phone||"").includes(search)||
      s.sender.includes(search)||
      s.destination.includes(search);
    return mf&&ms;
  }).sort((a,b)=>{
    const p={"عاجلة":4,"يحتاج مراجعة":3,"جديدة":2};
    return (p[b.status]||0)-(p[a.status]||0)||(new Date(b.created_at)-new Date(a.created_at));
  });

  const stats = {
    total: dateFiltered.length,
    urgent: dateFiltered.filter(s=>s.status==="عاجلة").length,
    review: dateFiltered.filter(s=>s.status==="يحتاج مراجعة").length,
    new: dateFiltered.filter(s=>s.status==="جديدة").length,
    active: dateFiltered.filter(s=>["في الطريق","تم الاستلام","قريب من التسليم"].includes(s.status)).length,
    done: dateFiltered.filter(s=>s.status==="تم التسليم").length,
    returned: dateFiltered.filter(s=>s.status==="مرتجعة").length,
    revenue: dateFiltered.filter(s=>s.status==="تم التسليم").reduce((sum,s)=>sum+Number(s.final_price||s.price),0),
    cod: dateFiltered.filter(s=>s.payment_type==="COD"&&!["ملغية","مرتجعة"].includes(s.status)).reduce((sum,s)=>sum+Number(s.final_price||s.price),0),
  };

  const handleUpdate = async (id, type, value) => {
    const shipment = shipments.find(s=>s.id===id);
    if(!shipment) return;
    let fields = {};
    if(type==="status") {
      fields = {status:value};
      if(settings.tgToken&&settings.tgChatId){
        sendTG(settings.tgToken, settings.tgChatId,
          `📦 *${settings.companyName}*\nتحديث #${shipment.tracking_code}\nالحالة: *${value}*\n👤 ${shipment.customer_name||"—"}`);
      }
    } else if(type==="driver") {
      fields = {driver_id:value.id, driver_name:value.name};
      if(settings.tgToken&&settings.tgChatId){
        sendTG(settings.tgToken, settings.tgChatId,
          `🧑‍💼 *تعيين مندوب*\nشحنة #${shipment.tracking_code}\nالمندوب: *${value.name}*`);
      }
    } else if(type==="note") {
      fields = {note:value};
    }
    await db.updateShipment(id, fields);
    onUpdate(id, fields);
    showToast(type==="status"?`📦 "${value}"`:type==="driver"?`🧑‍💼 ${value.name}`:"📝 تم حفظ الملاحظة");
  };

  const handleAddShipment = async (data) => {
    const saved = await db.insertShipment(data);
    if(saved){
      onAddShipment(saved);
      setShowAdd(false);
      showToast(`✅ شحنة جديدة: ${saved.tracking_code}`);
      if(settings.tgToken&&settings.tgChatId){
        sendTG(settings.tgToken, settings.tgChatId,
          `📦 *${settings.companyName}* — شحنة جديدة!\n🆔 ${saved.tracking_code}\n👤 ${saved.customer_name||"—"}\n📍 ${saved.destination}\n💰 ${saved.final_price} د.ل`);
      }
    } else showToast("❌ خطأ في الحفظ", T.red);
  };

  return(
    <div style={{direction:"rtl",fontFamily:"inherit",minHeight:"100vh",background:T.bg,color:T.text}}>
      {printShipment&&<ShipmentLabel shipment={printShipment} company={settings.companyName||"خُطوة"} onClose={()=>setPrintShipment(null)}/>}
      {showAdd&&<AddShipmentModal drivers={drivers} onSave={handleAddShipment} onClose={()=>setShowAdd(false)}/>}
      {showConvs&&<ConversationsPanel onClose={()=>setShowConvs(false)}/>}

      {/* TOP BAR */}
      <div style={{background:T.card,borderBottom:`1px solid ${T.border}`,padding:"0 16px",position:"sticky",top:0,zIndex:50,boxShadow:"0 2px 16px rgba(0,0,0,0.3)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:T.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📦</div>
            <div>
              <div style={{fontWeight:900,fontSize:15,color:T.text}}>{settings.companyName||"خُطوة"}</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:dbStatus==="ok"?T.green:T.red,display:"inline-block"}}/>
                <span style={{color:T.muted,fontSize:10}}>{dbStatus==="ok"?"متصل ✅":"يتصل..."}</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {stats.urgent>0&&<button onClick={()=>setFilter("عاجلة")} style={{background:T.red+"22",color:T.red,border:`1px solid ${T.red}44`,borderRadius:8,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🚨 {stats.urgent}</button>}
            {stats.review>0&&<button onClick={()=>setFilter("يحتاج مراجعة")} style={{background:T.orange+"22",color:T.orange,border:`1px solid ${T.orange}44`,borderRadius:8,padding:"5px 9px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⚠️ {stats.review}</button>}
            <Btn onClick={()=>setShowAdd(true)} style={{padding:"7px 14px",fontSize:12}}>+ شحنة جديدة</Btn>
            <button onClick={()=>setShowConvs(true)} style={{background:T.bg2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"7px 10px",fontSize:13,cursor:"pointer"}}>💬</button>
            <button onClick={onOpenSettings} style={{background:T.bg2,border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"7px 10px",fontSize:15,cursor:"pointer"}}>⚙️</button>
            <button onClick={onLogout} style={{background:"transparent",color:T.muted,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>🔒</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"14px"}}>
        {/* فلتر التاريخ */}
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {["الكل","اليوم","الأسبوع"].map(d=>(
            <button key={d} onClick={()=>setDateFilter(d)}
              style={{background:dateFilter===d?T.blue:T.card,color:dateFilter===d?"#fff":T.muted,border:`1.5px solid ${dateFilter===d?T.blue:T.border}`,borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {d==="الكل"?"📅 الكل":d==="اليوم"?"🌅 اليوم":"📆 الأسبوع"}
            </button>
          ))}
        </div>

        {/* STATS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
          <Stat icon="📦" label="إجمالي" value={stats.total} color={T.blue}/>
          <Stat icon="⚡" label="جارية" value={stats.active} color={T.orange}/>
          <Stat icon="✅" label="تسليم" value={stats.done} color={T.green} sub={`${stats.total>0?Math.round(stats.done/stats.total*100):0}%`}/>
          <Stat icon="↩️" label="مرتجعة" value={stats.returned} color={T.red}/>
          <Stat icon="💰" label="إيرادات" value={`${fmtNum(stats.revenue)} د.ل`} color={T.yellow}/>
        </div>

        {/* TABS */}
        <div style={{display:"flex",gap:3,marginBottom:16,background:T.card,borderRadius:12,padding:4,border:`1px solid ${T.border}`}}>
          {[["shipments","📦 الشحنات"],["drivers","👥 المناديب"],["stats","📊 الإحصائيات"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)}
              style={{flex:1,background:tab===v?T.blue:"transparent",color:tab===v?"#fff":T.muted,border:"none",borderRadius:9,padding:"9px 5px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
              {l}
            </button>
          ))}
        </div>

        {/* SHIPMENTS */}
        {tab==="shipments"&&(
          <>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input placeholder="🔍 بحث برقم التتبع، الاسم، الهاتف..." value={search} onChange={e=>setSearch(e.target.value)}
                style={{flex:1,borderRadius:10,border:`1.5px solid ${T.border}`,padding:"10px 13px",fontSize:13,fontFamily:"inherit",background:T.card,color:T.text,outline:"none"}}
                onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
            <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
              {FILTERS.map(f=>{
                const sc = STATUS_CONFIG[f];
                const active = filter===f;
                const cnt = f==="الكل"?dateFiltered.length:dateFiltered.filter(s=>s.status===f).length;
                return(
                  <button key={f} onClick={()=>setFilter(f)}
                    style={{background:active?(sc?.color||T.blue):T.card,color:active?"#fff":T.muted,border:`1px solid ${active?(sc?.color||T.blue):T.border}`,borderRadius:18,padding:"5px 11px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>
                    {f}{cnt>0?` (${cnt})`:""}
                  </button>
                );
              })}
            </div>
            {filtered.length===0
              ?<div style={{textAlign:"center",color:T.muted,padding:"50px 0"}}><div style={{fontSize:40,marginBottom:10}}>📭</div>لا توجد شحنات</div>
              :filtered.map(s=><ShipmentCard key={s.id} s={s} drivers={drivers} onUpdate={handleUpdate} onPrint={setPrintShipment} settings={settings}/>)
            }
          </>
        )}

        {tab==="drivers"&&<DriversPage drivers={drivers} onRefresh={onRefreshDrivers} shipments={shipments}/>}
        {tab==="stats"&&<StatsPage shipments={dateFiltered} drivers={drivers} driverComm={driverComm}/>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════════
export default function App() {
  const isDriver = window.location.pathname==="/driver"||new URLSearchParams(window.location.search).get("driver")==="1";
  const isBot    = window.location.pathname==="/bot"||new URLSearchParams(window.location.search).get("bot")==="1";

  const [page,       setPage]       = useState("login");
  const [shipments,  setShipments]  = useState([]);
  const [drivers,    setDrivers]    = useState([]);
  const [settings,   setSettings]   = useState({companyName:"خُطوة",companySlogan:"توصيل سريع وموثوق",waGroupNumber:"",adminPhone:"",tgToken:"",tgChatId:""});
  const [driverComm, setDriverComm] = useState(0.7);
  const [toast,      setToast]      = useState(null);
  const [dbStatus,   setDbStatus]   = useState("connecting");
  const [loading,    setLoading]    = useState(true);

  const showToast = useCallback((msg, color=T.green) => {
    setToast({msg,color});
    try {
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const play = (f,s,d,v=0.2) => {
        const o=ctx.createOscillator(); const g=ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(f,ctx.currentTime+s);
        g.gain.setValueAtTime(v,ctx.currentTime+s);
        g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+s+d);
        o.start(ctx.currentTime+s); o.stop(ctx.currentTime+s+d);
      };
      if(color===T.red){play(880,0,0.1,0.3);play(660,0.12,0.1,0.3);}
      else{play(600,0,0.08,0.2);play(800,0.1,0.12,0.25);}
    } catch {}
    setTimeout(()=>setToast(null),3000);
  },[]);

  useEffect(()=>{
    if(isDriver||isBot) { setLoading(false); return; }
    const load = async () => {
      const [sData, dData, cfg] = await Promise.all([db.getShipments(), db.getDrivers(), db.getSettings()]);
      setShipments(sData); setDrivers(dData);
      if(cfg&&Object.keys(cfg).length>0){
        setSettings(prev=>({...prev,...cfg}));
        if(cfg.driverComm) setDriverComm(Number(cfg.driverComm));
        if(cfg.adminPin) window.__KHOTWA_PIN = cfg.adminPin;
      }
      setDbStatus("ok"); setLoading(false);
    };
    load();
    const iv = setInterval(async()=>{
      const sData = await db.getShipments();
      if(sData){
        setShipments(prev=>{
          const newOnes = sData.filter(s=>!prev.find(p=>p.id===s.id));
          newOnes.forEach(s=>{
            if(s.status==="عاجلة") showToast(`🚨 شحنة عاجلة: ${s.tracking_code}`,T.red);
            else showToast(`🔔 شحنة جديدة: ${s.tracking_code}`,T.blue);
          });
          return sData;
        });
        setDbStatus("ok");
      }
    },10000);
    return()=>clearInterval(iv);
  },[]);

  const refreshDrivers = async () => {
    const dData = await db.getDrivers();
    setDrivers(dData);
  };

  const saveSettings = async (obj) => {
    setSettings(prev=>({...prev,...obj}));
    await db.saveSettings(obj);
  };

  // واجهة المندوب
  if(isDriver) return <DriverApp/>;

  // واجهة الزبون (البوت)
  if(isBot) return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",direction:"rtl",fontFamily:"inherit",color:T.text}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:12}}>📦</div>
        <div style={{fontSize:20,fontWeight:900,color:T.text}}>{settings.companyName||"خُطوة"}</div>
        <div style={{fontSize:13,color:T.muted,marginTop:4}}>{settings.companySlogan}</div>
        <div style={{marginTop:20,background:T.card,borderRadius:12,padding:"14px 20px",border:`1px solid ${T.border}`,fontSize:13,color:T.muted}}>
          🤖 البوت يعمل — راسلنا على واتساب
          {settings.waGroupNumber&&(
            <div style={{marginTop:8}}>
              <a href={buildWA(settings.waGroupNumber,"مرحباً، أريد خدمة توصيل")} target="_blank" rel="noreferrer"
                style={{background:"#25D366",color:"#fff",borderRadius:9,padding:"8px 16px",fontSize:13,fontWeight:700,textDecoration:"none",display:"inline-block"}}>
                📱 تواصل معنا
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if(loading) return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,fontFamily:"inherit"}}>
      <div style={{width:56,height:56,borderRadius:16,background:T.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>📦</div>
      <div style={{color:T.text,fontSize:20,fontWeight:900}}>خُطوة</div>
      <div style={{color:T.muted,fontSize:13}}>جاري الاتصال...</div>
      <div style={{width:32,height:32,border:"3px solid #333",borderTop:`3px solid ${T.blue}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <>
      {toast&&<Toast msg={toast.msg} color={toast.color}/>}
      {page==="login"&&<LoginPage onLogin={()=>setPage("dashboard")} company={settings.companyName}/>}
      {page==="settings"&&(
        <SettingsPage settings={settings} onSave={saveSettings} driverComm={driverComm} onCommChange={setDriverComm} onBack={()=>setPage("dashboard")}/>
      )}
      {page==="dashboard"&&(
        <Dashboard
          shipments={shipments} drivers={drivers} settings={settings}
          onUpdate={(id,fields)=>setShipments(prev=>prev.map(s=>s.id===id?{...s,...fields}:s))}
          onAddShipment={s=>setShipments(prev=>[s,...prev])}
          onLogout={()=>setPage("login")}
          dbStatus={dbStatus} driverComm={driverComm}
          onOpenSettings={()=>setPage("settings")}
          onRefreshDrivers={refreshDrivers}
          showToast={showToast}
        />
      )}
    </>
  );
}
