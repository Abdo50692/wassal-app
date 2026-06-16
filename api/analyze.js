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
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text,
        parse_mode: "Markdown"
      })
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
  console.log("OpenRouter Key exists:", !!OPENROUTER_KEY, OPENROUTER_KEY?.slice(0,15));
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer": "https://wassal-app.vercel.app",
      "X-Title": "Wassal Bot",
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct:free", // التعديل الذهبي لحل مشكلة الـ ID والموديل 🚀
      messages,
      temperature: 0.2,
      max_tokens: 800,
    }),
  });
  const data = await r.json();
  console.log("OpenRouter status:", r.status, JSON.stringify(data).slice(0,200));
  if(!r.ok) throw new Error(`OpenRouter ${r.status}: ${JSON.stringify(data)}`);
  return data.choices?.[0]?.message?.content || "";
}

// ══════════════════════════════════════════════
//  SYSTEM PROMPT
// ══════════════════════════════════════════════
const getSystemPrompt = (companyName) => `أنت بوت خدمة عملاء ذكي لشركة "${companyName}" للتوصيل في ليبيا (طرابلس وضواحيها، 9 صباحاً - 11 ليلاً).

## شخصيتك:
- ترد بالعامية الليبية بأسلوب ودود ومهني
- تفهم: خردة، رواجع، لوكيشن، فكة، حاجة، توصيلة، مندوب
- سؤال واحد واضح في كل رسالة
- لا تعيد السؤال عن معلومات ذكرها الزبون

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

## المسارات:

### تتبع الطلبية:
إذا ذكر رقم طلب (يبدأ بـ W-) → ابحث في قاعدة البيانات وأخبره بالحالة
إذا لم يذكر الرقم → اسأله: "ابعتلي رقم طلبيتك يا غالي (يبدأ بـ W-)"

### توصيل بضاعة/طرد:
اجمع خطوة بخطوة: اسم الزبون → رقم الهاتف → نوع البضاعة → من أين → إلى أين → السعر إن ذُكر
بعد اكتمال البيانات → أرسل ملخصاً للتأكيد

### طلب مطعم:
اجمع: اسم المطعم → الطلب → عنوان التوصيل → رقم الهاتف

### التحويل للمدير:
في حالات: منطقة خارج التغطية، شكوى، طلب عاجل، مشكلة مالية، "أريد موظف"
قل: "تم تحويلك لأحد المختصين، سيتواصل معك قريباً ⏳"

### الطوارئ:
كلمات (عاجل، سرعة، ضروري) → ارفع الأولوية

## قواعد الرد:
- ردودك قصيرة ومباشرة
- إذا اكتملت بيانات الطلب أرجع في آخر ردك:
<<<ORDER_READY>>>
{"order_complete":true,"customer_name":"...","phone":"...","sender":"...","package_type":"...","details":"...","destination":"...","price":0,"priority":"normal"}
<<<END>>>

- إذا تأكد الزبون على الملخص أرجع:
<<<ORDER_CONFIRMED>>>
{"confirmed":true}
<<<END>>>

- إذا تحويل للمدير:
<<<ESCALATE>>>
{"escalate":true,"reason":"...","customer_name":"...","phone":"..."}
<<<END>>>

- إذا يريد تتبع طلب:
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
    // ── جلب المحادثة
    let conv = await getConversation(phone);

    // ── فحص timeout
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

    // ── استدعاء الذكاء الاصطناعي
    const reply = await callGemini(geminiMessages);

    // ── تحديث تاريخ المحادثة
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
          const statusEmoji = {
            "جديد":"🆕", "قيد التوصيل":"🚴", "قريب من التسليم":"🏃",
            "مكتمل":"✅", "متأخر":"⏳", "ملغي":"❌"
          };
          tracked = `📦 طلبيتك #${order.order_id}\n${statusEmoji[order.status]||"📦"} الحالة: *${order.status}*\n${order.driver_name ? `🧑‍💼 المندوب: ${order.driver_name}` : ""}`;
        } else {
          tracked = "❌ ما لقيت طلبية بهذا الرقم. تأكد من الرقم يا غالي.";
        }
      } catch {}
    }

    // ── فحص اكتمال الطلب
    const orderMatch = reply.match(/<<<ORDER_READY>>>([\s\S]*?)<<<END>>>/);
    if (orderMatch) {
      try {
        orderData = JSON.parse(orderMatch[1].trim());
        // احفظ في draft للتأكيد
        await updateConversation(phone, {
          messages: updatedMessages,
          current_step: "awaiting_confirmation",
          draft_order: orderData,
          last_message_at: new Date().toISOString()
        });
      } catch {}
    }

    // ── فحص التأكيد
    const confirmMatch = reply.match(/<<<ORDER_CONFIRMED>>>([\s\S]*?)<<<END>>>/);
    if (confirmMatch && conv.draft_order && Object.keys(conv.draft_order).length > 0) {
      const draft = conv.draft_order;
      const orderId = genId();
      const saved = await saveOrder({
        order_id: orderId,
        customer_name: draft.customer_name || null,
        client_phone: draft.phone || phone,
        sender: draft.sender || "غير محدد",
        package_type: draft.package_type || "طرود عامة",
        details: draft.details || message,
        destination: draft.destination || "غير محدد",
        price: draft.price || 0,
        status: draft.priority === "urgent" ? "عاجل" : "جديد",
        driver_name: null,
        source: "bot",
        date: todayDate(),
        time: nowTime(),
        needs_manual_review: false,
      });

      if (saved) {
        orderSaved = true;
        orderData = {...draft, id: orderId};

        // ✈️ إرسال تيليغرام تلقائي
        await sendTelegram(
`🚀 *${companyName}* — طلب جديد!
━━━━━━━━━━━━━━━
🆔 رقم الطلب: \`${orderId}\`
👤 الزبون: ${draft.customer_name || "غير محدد"}
📞 الهاتف: ${draft.phone || "غير محدد"}
📦 المرسل/المحل: ${draft.sender || "غير محدد"}
🎁 النوع: ${draft.package_type || "غير محدد"}
📝 التفاصيل: ${draft.details || "—"}
🏠 التوصيل إلى: ${draft.destination || "غير محدد"}
💰 التكلفة: ${draft.price || 0} د.ل
🕐 الوقت: ${nowTime()}
━━━━━━━━━━━━━━━
للاستلام ردوا بـ: *عندي* أو *خديته* 🚗`
        );

        // إعادة تعيين المحادثة
        await updateConversation(phone, {
          messages: [], current_step: "welcome",
          draft_order: {}, last_message_at: new Date().toISOString()
        });
      }
    }

    // ── فحص التحويل للمدير
    const escalateMatch = reply.match(/<<<ESCALATE>>>([\s\S]*?)<<<END>>>/);
    if (escalateMatch) {
      try {
        const escData = JSON.parse(escalateMatch[1].trim());
        escalate = true;

        // إرسال تيليغرام للتحويل
        await sendTelegram(
`🚨 *تحويل للإدارة!*
👤 الزبون: ${escData.customer_name || "غير محدد"}
📞 الرقم: ${escData.phone || phone}
📝 السبب: ${escData.reason || "يحتاج تدخل بشري"}`
        );

        await updateConversation(phone, {
          messages: updatedMessages, current_step: "escalated",
          last_message_at: new Date().toISOString()
        });
      } catch {}
    }

    // ── تحديث المحادثة إذا لم يكتمل طلب
    if (!orderSaved && !escalate && !orderMatch) {
      await updateConversation(phone, {
        messages: updatedMessages,
        current_step: "in_progress",
        last_message_at: new Date().toISOString()
      });
    }

    // ── تنظيف الرد
    const cleanReply = (tracked || reply)
      .replace(/<<<ORDER_READY>>>[\s\S]*?<<<END>>>/g, "")
      .replace(/<<<ORDER_CONFIRMED>>>[\s\S]*?<<<END>>>/g, "")
      .replace(/<<<ESCALATE>>>[\s\S]*?<<<END>>>/g, "")
      .replace(/<<<TRACK>>>[\s\S]*?<<<END>>>/g, "")
      .trim();

    return res.status(200).json({
      reply: cleanReply || "تم استلام رسالتك ✅",
      order_saved: orderSaved,
      escalate,
      is_new_user: isNew,
      order_data: orderData,
    });

  } catch (error) {
    console.error("Bot error:", error);
    return res.status(200).json({
      reply: "تم استلام رسالتك ✅ سيتواصل معك فريقنا قريباً.",
      order_saved: false,
    });
  }
}
