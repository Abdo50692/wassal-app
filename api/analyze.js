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
//  OpenRouter — الموديلات بالترتيب المستقر
// ══════════════════════════════════════════════
async function callGemini(messages) {
  const models = [
    "google/gemini-2.5-flash",
    "meta-llama/llama-3.3-70b-instruct:free",
    "mistralai/mistral-7b-instruct:free"
  ];

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`Trying model: ${model}`);
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": "https://wassal-app.vercel.app",
          "X-Title": "Wassal Bot",
        },
        body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 800 }),
      });

      const data = await r.json();

      if (!r.ok || data.error) {
        console.warn(`Model ${model} failed. Trying next...`);
        lastError = data.error?.message || `Status ${r.status}`;
        continue;
      }

      if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(`All models failed. Last error: ${lastError}`);
}

// ══════════════════════════════════════════════
//  SYSTEM PROMPT — تعديل توجيهات استخراج الرقمين
// ══════════════════════════════════════════════
const getSystemPrompt = (companyName) => `أنت بوت خدمة عملاء ذكي، سريع ومرح جداً لشركة "${companyName}" للتوصيل في ليبيا (طرابلس وضواحيها، 9 صباحاً - 11 ليلاً).

## شخصيتك وأسلوبك:
- ترد بالعامية الليبية الدافئة والمبهجة المليئة بالسمايلات التفاعلية (منور يا غالي! ✨، عيوني ليك 👀، مية مية 👍).
- أسلوبك سلس ومريح جداً.

## رسالة الترحيب (للجديد فقط):
"👋 أهلاً وسهلاً بيك في ${companyName}! 🚀✨

خدماتنا السريعة:
📦 توصيل البضائع والطرود والطلبيات
🍔 توصيل من المطاعم المفضلة عندك 
🚚 شحن سريع وآمن بين المدن
⚡ سرعة، أمان، وثقة مية مية 🔥

⏰ دوامنا من 9 صباحاً لـ 11 ليلاً | 📍 طرابلس وضواحيها

شن نقدر نسوولك اليوم يا غالي؟ خذ راحتك ودلل! 😊👇"

## المسارات والبيانات السريعة:

### توصيل بضاعة/طرد (عندي طلبية):
عند أول إشارة للتوصيل، اطلب تفاصيل الطرد مع التنويه على رقم المستلم:
"من عيوني يا غالي! 📦✨ اعطيني تفاصيل الطلبية برمشة عين:
🎁 شنو نوع الطرد أو البضاعة؟
📍 من وين نجيبوها (المكان/المحل)؟
🏠 وتوصل لوين بالضبط (العنوان)؟
📞 رقم هاتف الشخص المستلم؟ (لو كان مختلف عن رقمك الحالي)
💰 السعر المتفق عليه (إن وجد)؟"

*ملاحظة هامة جداً لك:* 
- استخرج رقم هاتف المستلم إذا ذكره الزبون وضعه في خانة "phone" داخل الـ JSON. 
- إذا قال الزبون أن الرقم هو نفسه رقمه أو لم يذكر رقم مستلم على الإطلاق، اترك خانة "phone" فارغة أو اكتب فيها "نفسه".

## قواعد الحفظ والملخص:
- إذا اكتملت البيانات أدرج الكود في نهاية ردك:
<<<ORDER_READY>>>
{"order_complete":true,"customer_name":"زبون معروف","phone":"","sender":"—","package_type":"طرد","details":"—","destination":"—","price":0,"priority":"normal"}
<<<END>>>

- إذا تأكد الزبون وقال نعم/تمام أدرج:
<<<ORDER_CONFIRMED>>>
{"confirmed":true}
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
      const timeoutReply = "مرحباً يا غالي! 👋 هل تريد:\n1️⃣ كمّل طلبك السابق\n2️⃣ ابدأ طلب جديد";
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

    const trackMatch = reply.match(/<<<TRACK>>>([\s\S]*?)<<<END>>>/);
    if (trackMatch) { /* كود التتبع كما هو */ }

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

    // ⚡ نظام الأمان المزدوج الذكي
    const confirmMatch = reply.match(/<<<ORDER_CONFIRMED>>>([\s\S]*?)<<<END>>>/);
    const textClean = message.trim().toLowerCase();
    const userSaidYes = ["نعم", "تمام", "أكيد", "صح", "موافق", "ميه ميه", "مية مية", "توكل", "صار"].some(word => textClean.includes(word));

    if ((confirmMatch || (conv.current_step === "awaiting_confirmation" && userSaidYes)) && conv.draft_order && Object.keys(conv.draft_order).length > 0) {
      const draft = conv.draft_order;
      const orderId = genId();
      
      // 🚀 هنا السحر الجديد: معالجة رقم الطلب ورقم المستلم
      const senderPhone = phone; // الرقم الحالي اللي يراسل منه البوت (المرسل)
      let receiverPhone = draft.phone && draft.phone !== "..." && draft.phone !== "نفسه" ? draft.phone : phone; 

      const finalName = draft.customer_name && draft.customer_name !== "..." ? draft.customer_name : "زبون معروف";

      // ندمج تفاصيل الرقمين في حقل الـ details لتظهر بوضوح تام في الـ Database للمندوب
      const enhancedDetails = `رقم المرسل: ${senderPhone}\nرقم المستلم: ${receiverPhone}\nتفاصيل إضافية: ${draft.details || message}`;

      const saved = await saveOrder({
        order_id: orderId,
        customer_name: finalName,
        client_phone: receiverPhone, // نخزن رقم المستلم كحقل أساسي للتوصيل
        sender: draft.sender || "غير محدد",
        package_type: draft.package_type || "طرود عامة",
        details: enhancedDetails, // تفصيل الرقمين بالكامل هنا 🌟
        destination: draft.destination || "غير محدد",
        price: draft.price || 0,
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

        // إرسال التقرير الاحترافي لجروب التيليغرام موضحاً فيه الرقمين منفصلين 🔥
        await sendTelegram(
`🚀 *${companyName}* — طلب جديد مؤكد! ✨
━━━━━━━━━━━━━━━
🆔 رقم الطلب: \`${orderId}\`
👤 الزبون: ${finalName}
📞 هاتف المرسِـل: ${senderPhone}
📞 هاتف المستلِم: ${receiverPhone}
📦 من (المرسل): ${draft.sender || "غير محدد"}
🏠 إلى (الوجهة): ${draft.destination || "غير محدد"}
🎁 نوع البضاعة: ${draft.package_type || "غير محدد"}
💰 التكلفة: ${draft.price || 0} د.ل
🕐 الوقت: ${nowTime()}
━━━━━━━━━━━━━━━`
        );

        const successReply = `تم تأكيد طلبك بنجاح يا غالي! ✅🥳\n🆔 رقم طلبيتك هو: *${orderId}*\n\nالمندوب حيتواصل مع المستلم قريباً جداً. شرفتنا ونورتنا دائماً! 🙏✨🚀`;
        
        await updateConversation(phone, {
          messages: [{ role: "assistant", content: successReply }],
          current_step: "welcome",
          draft_order: {},
          last_message_at: new Date().toISOString()
        });

        return res.status(200).json({ reply: successReply, order_saved: true, escalate: false, is_new_user: false, order_data: orderData });
      }
    }

    if (!orderSaved && !escalate && !orderMatch) {
      await updateConversation(phone, { messages: updatedMessages, current_step: (conv.current_step === "awaiting_confirmation" && !userSaidYes) ? "awaiting_confirmation" : "in_progress", last_message_at: new Date().toISOString() });
    }

    const cleanReply = reply
      .replace(/<<<ORDER_READY>>>[\s\S]*?<<<END>>>/g, "")
      .replace(/<<<ORDER_CONFIRMED>>>[\s\S]*?<<<END>>>/g, "")
      .replace(/<<<ESCALATE>>>[\s\S]*?<<<END>>>/g, "")
      .trim();

    return res.status(200).json({ reply: cleanReply || "تم استقبال رسالتك بنجاح! ✅", order_saved: orderSaved, escalate, is_new_user: isNew, order_data: orderData });

  } catch (error) {
    console.error("Bot error:", error);
    return res.status(200).json({ reply: "تم استلام رسالتك ✅ سيتواصل معك فريقنا قريباً.", order_saved: false });
  }
}
