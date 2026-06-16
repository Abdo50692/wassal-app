const SUPABASE_URL  = process.env.SUPABASE_URL  || "https://iwivofotgjianvthgntm.supabase.co";
const SUPABASE_KEY  = process.env.SUPABASE_KEY  || "sb_publishable_WLNGtMZR3yXbDrd3vFwMkQ_VWa4J2Ln";
const OPENROUTER_KEY= process.env.OPENROUTER_API_KEY;
const TG_TOKEN      = process.env.TELEGRAM_TOKEN || "8941922503:AAGszlwAC6p76jdK9IBK4kKR--fF8g60wMc";
const TG_CHAT_ID    = process.env.TELEGRAM_CHAT_ID || "-1004385283242";

const sbH = {
  "Content-Type":"application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer": "return=representation"
};

const genId = () => "W-" + Date.now().toString().slice(-6);
const nowTime = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const todayDate = () => new Date().toISOString().split("T")[0];

// ══════════════════════════════════════════════
//  تيليغرام — إرسال رسالة للجروب
// ══════════════════════════════════════════════
async function sendTelegram(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "Markdown" })
    });
  } catch(e) { console.error("Telegram error:", e); }
}

// ══════════════════════════════════════════════
//  Supabase
// ══════════════════════════════════════════════
async function getConversation(phone) {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?phone_number=eq.${encodeURIComponent(phone)}&select=*`,
      { headers: sbH }
    );
    const data = await r.json();
    if (data && data.length > 0) return data[0];

    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
      method: "POST", headers: sbH,
      body: JSON.stringify({
        phone_number: phone, messages: [], current_step: "welcome",
        draft_order: {}, last_message_at: new Date().toISOString()
      })
    });
    const d2 = await r2.json();
    return Array.isArray(d2) ? d2[0] : d2;
  } catch { return { phone_number: phone, messages: [], current_step: "welcome", draft_order: {} }; }
}

async function updateConversation(phone, updates) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?phone_number=eq.${encodeURIComponent(phone)}`,
      { method: "PATCH", headers: sbH, body: JSON.stringify(updates) }
    );
  } catch {}
}

async function saveOrder(order) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: "POST", headers: sbH, body: JSON.stringify(order)
    });
    return r.ok;
  } catch { return false; }
}

async function getOrderStatus(orderId) {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}&select=*`,
      { headers: sbH }
    );
    const data = await r.json();
    return data && data.length > 0 ? data[0] : null;
  } catch { return null; }
}

// ══════════════════════════════════════════════
//  OpenRouter الاتصال بالذكاء الاصطناعي
// ══════════════════════════════════════════════
async function callGemini(messages) {
  const models = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.5-flash",
    "mistralai/mistral-7b-instruct:free"
  ];

  let lastError = null;
  for (const model of models) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": "https://wassal-app.vercel.app",
          "X-Title": "Wassal Bot",
        },
        body: JSON.stringify({ model: model, messages, temperature: 0.1, max_tokens: 800 }),
      });

      const data = await r.json();
      if (!r.ok || data.error) {
        lastError = data.error?.message || `Status ${r.status}`;
        continue; 
      }
      if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    } catch (err) { lastError = err.message; }
  }
  throw new Error(`All models failed. Last error: ${lastError}`);
}

// ══════════════════════════════════════════════
//  SYSTEM PROMPT (تم تشديد شروط التأكيد هنا ⚙️)
// ══════════════════════════════════════════════
const getSystemPrompt = (companyName) => `أنت بوت خدمة عملاء ذكي لشركة "${companyName}" للتوصيل في ليبيا (طرابلس وضواحيها، 9 صباحاً - 11 ليلاً).

## شخصيتك:
- ترد بالعامية الليبية بأسلوب ودود ومهني
- سؤال واحد واضح في كل رسالة

## رسالة الترحيب (للجديد فقط — current_step=welcome):
"👋 مرحباً بك في ${companyName}!

🚀 خدماتنا:
📦 توصيل البضائع والطرود داخل المدينة
🍔 توصيل من المطاعم
🚚 شحن بين المدن
⚡ سريع، آمن، وموثوق مية مية

⏰ 9 صباحاً - 11 ليلاً | 📍 طرابلس وضواحيها

كيف نقدر نساعدك يا غالي؟
1️⃣ تتبع طلبية
2️⃣ توصيل بضاعة أو طرد
3️⃣ طلب من مطعم
4️⃣ التحدث مع الدعم"

## قواعد الرد والملخصات (هام جداً):
1. عندما يكتمل جمع البيانات، اعرض الملخص للزبون فوراً واسأله للتأكيد. وعند عرض الملخص أضف النص المخفي التالي في نهاية ردك لتهيئة النظام:
<<<ORDER_READY>>>
{"order_complete":true,"customer_name":"...","phone":"...","sender":"...","package_type":"...","details":"...","destination":"...","price":80,"priority":"normal"}
<<<END>>>

2. إجباري وصارم: عندما يوافق الزبون على الملخص ويقول (نعم، تمام، صح، وافق، مية مية، توكل على الله)، يجب عليك إلزامياً وبدون أي خطأ إدراج النص التالي في نهاية ردك التأكيدي لكي يتمكن السيرفر من حفظ البيانات:
<<<ORDER_CONFIRMED>>>
{"confirmed":true}
<<<END>>>

3. إذا طلب الزبون تحويل للمدير:
<<<ESCALATE>>>
{"escalate":true,"reason":"...","customer_name":"...","phone":"..."}
<<<END>>>

4. إذا كان يريد تتبع طلب:
<<<TRACK>>>
{"order_id":"W-XXXXXX"}
<<<END>>>`;

// ══════════════════════════════════════════════
//  MAIN HANDLER
// ══════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, phone = "web-user", companyName = "وصّل" } = req.body || {};
  if (!message) return res.status(400).json({ error: "No message" });

  try {
    let conv = await getConversation(phone);
    const lastMsg = new Date(conv.last_message_at || Date.now());
    const minutesSince = (Date.now() - lastMsg) / 60000;

    if (minutesSince > 60) {
      conv.messages = [];
      conv.current_step = "welcome";
      conv.draft_order = {};
    } else if (minutesSince > 10 && conv.current_step !== "welcome" && Object.keys(conv.draft_order || {}).length > 0) {
      const timeoutReply = "مرحباً! 👋 هل تريد:\n1️⃣ كمّل طلبك السابق\n2️⃣ ابدأ طلب جديد";
      return res.status(200).json({ reply: timeoutReply, order_saved: false });
    }

    const isNew = !conv.messages || conv.messages.length === 0;
    const history = (conv.messages || []).slice(-12);

    const geminiMessages = [
      { role: "system", content: getSystemPrompt(companyName) },
      ...history,
      { role: "user", content: message }
    ];

    const reply = await callGemini(geminiMessages);

    const updatedMessages = [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content: reply }
    ];

    let orderSaved = false;
    let escalate = false;
    let orderData = null;
    let tracked = null;

    // ── فحص التتبع
    const trackMatch = reply.match(/<<<TRACK>>>([\s\S]*?)<<<END>>>/);
    if (trackMatch) {
      try {
        const trackData = JSON.parse(trackMatch[1].trim());
        const order = await getOrderStatus(trackData.order_id);
        if (order) {
          const statusEmoji = { "جديد":"🆕", "قيد التوصيل":"🚴", "قريب من التسليم":"🏃", "مكتمل":"✅", "متأخر":"⏳", "ملغي":"❌" };
          tracked = `📦 طلبيتك #${order.order_id}\n${statusEmoji[order.status]||"📦"} الحالة: *${order.status}*\n${order.driver_name ? `🧑‍💼 المندوب: ${order.driver_name}` : ""}`;
        } else { tracked = "❌ ما لقيت طلبية بهذا الرقم. تأكد من الرقم يا غالي."; }
      } catch {}
    }

    // ── فحص جهوزية الملخص
    const orderMatch = reply.match(/<<<ORDER_READY>>>([\s\S]*?)<<<END>>>/);
    if (orderMatch) {
      try {
        orderData = JSON.parse(orderMatch[1].trim());
        await updateConversation(phone, {
          messages: updatedMessages,
          current_step: "awaiting_confirmation",
          draft_order: orderData,
          last_message_at: new Date().toISOString()
        });
      } catch {}
    }

    // ⚡ الأمان الفائق: فحص الكود المخفي للتأكيد، أو التحقق برمجياً لو كانت الخطوة الحالية هي الانتظار والزبون قال "نعم"
    const confirmMatch = reply.match(/<<<ORDER_CONFIRMED>>>([\s\S]*?)<<<END>>>/);
    const textClean = message.trim().toLowerCase();
    const userSaidYes = ["نعم", "تمام", "أكيد", "صح", "موافق", "ميه ميه", "مية مية", "توكل", "اوكي", "ok"].some(word => textClean.includes(word));
    
    if ((confirmMatch || (conv.current_step === "awaiting_confirmation" && userSaidYes)) && conv.draft_order && Object.keys(conv.draft_order).length > 0) {
      const draft = conv.draft_order;
      const orderId = genId();
      const saved = await saveOrder({
        order_id: orderId,
        customer_name: draft.customer_name || "عبدالرحمن",
        client_phone: draft.phone || phone,
        sender: draft.sender || "غير محدد",
        package_type: draft.package_type || "طرود",
        details: draft.details || "توصيل طرد ملابس",
        destination: draft.destination || "غير محدد",
        price: draft.price || 80,
        status: "جديد",
        driver_name: null,
        source: "bot",
        date: todayDate(),
        time: nowTime(),
        needs_manual_review: false,
      });

      if (saved) {
        orderSaved = true;
        orderData = {...draft, id: orderId};

        // إرسال لجروب التيليغرام فوراً 🚀
        await sendTelegram(
`🚀 *${companyName}* — طلب جديد مؤكد!
━━━━━━━━━━━━━━━
🆔 رقم الطلب: \`${orderId}\`
👤 الزبون: ${draft.customer_name || "عبدالرحمن"}
📞 الهاتف: ${draft.phone || phone}
📦 المرسل/المحل: ${draft.sender || "دروب طرابلس"}
🎁 النوع: ${draft.package_type || "طرد ملابس"}
🏠 التوصيل إلى: ${draft.destination || "حي دمشق"}
💰 التكلفة: ${draft.price || 80} د.ل
🕐 الوقت: ${nowTime()}
━━━━━━━━━━━━━━━
للاستلام ردوا بـ: *عندي* 🚗`
        );

        // تصفير المحادثة للبدء من جديد
        await updateConversation(phone, {
          messages: [], current_step: "welcome",
          draft_order: {}, last_message_at: new Date().toISOString()
        });
      }
    }

    const escalateMatch = reply.match(/<<<ESCALATE>>>([\s\S]*?)<<<END>>>/);
    if (escalateMatch) {
      try {
        const escData = JSON.parse(escalateMatch[1].trim());
        escalate = true;
        await sendTelegram(`🚨 *تحويل للإدارة!*\n👤 الزبون: ${escData.customer_name || "غير محدد"}\n📞 الرقم: ${escData.phone || phone}\n📝 السبب: ${escData.reason || "يحتاج تدخل بشري"}`);
        await updateConversation(phone, { messages: updatedMessages, current_step: "escalated", last_message_at: new Date().toISOString() });
      } catch {}
    }

    if (!orderSaved && !escalate && !orderMatch) {
      await updateConversation(phone, { messages: updatedMessages, current_step: (conv.current_step === "awaiting_confirmation" && !userSaidYes) ? "awaiting_confirmation" : "in_progress", last_message_at: new Date().toISOString() });
    }

    const cleanReply = (tracked || reply)
      .replace(/<<<ORDER_READY>>>[\s\S]*?<<<END>>>/g, "")
      .replace(/<<<ORDER_CONFIRMED>>>[\s\S]*?<<<END>>>/g, "")
      .replace(/<<<ESCALATE>>>[\s\S]*?<<<END>>>/g, "")
      .replace(/<<<TRACK>>>[\s\S]*?<<<END>>>/g, "")
      .trim();

    return res.status(200).json({ reply: cleanReply || "تم تأكيد طلبك بنجاح! ✅", order_saved: orderSaved, escalate, is_new_user: isNew, order_data: orderData });

  } catch (error) {
    console.error("Bot error:", error);
    return res.status(200).json({ reply: "تم استلام رسالتك ✅ سيتواصل معك فريقنا قريباً.", order_saved: false });
  }
}
