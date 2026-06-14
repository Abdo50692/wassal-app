const SUPABASE_URL = process.env.SUPABASE_URL || "https://iwivofotgjianvthgntm.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_WLNGtMZR3yXbDrd3vFwMkQ_VWa4J2Ln";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

const sbH = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer": "return=representation"
};

// ── جلب أو إنشاء محادثة للزبون
async function getOrCreateConversation(phone) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?phone_number=eq.${encodeURIComponent(phone)}&select=*`,
    { headers: sbH }
  );
  const data = await r.json();
  if (data && data.length > 0) return data[0];

  // محادثة جديدة
  const r2 = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
    method: "POST",
    headers: sbH,
    body: JSON.stringify({
      phone_number: phone,
      messages: [],
      current_step: "welcome",
      draft_order: {},
      last_message_at: new Date().toISOString()
    })
  });
  const newConv = await r2.json();
  return Array.isArray(newConv) ? newConv[0] : newConv;
}

// ── تحديث المحادثة
async function updateConversation(phone, updates) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?phone_number=eq.${encodeURIComponent(phone)}`,
    { method: "PATCH", headers: sbH, body: JSON.stringify(updates) }
  );
}

// ── حفظ طلب في جدول orders
async function saveOrder(order) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: "POST",
    headers: sbH,
    body: JSON.stringify(order)
  });
  return r.ok;
}

// ── Gemini عبر OpenRouter مع ذاكرة المحادثة
async function callGemini(messages) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer": "https://wassal-app.vercel.app",
      "X-Title": "Wassal Delivery Bot",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp:free",
      messages,
      temperature: 0.2,
      max_tokens: 1000,
    }),
  });
  const data = await r.json();
  return data.choices?.[0]?.message?.content || "";
}

// ══════════════════════════════════════════════
//  SYSTEM PROMPT — شخصية البوت الكاملة
// ══════════════════════════════════════════════
const SYSTEM_PROMPT = `أنت بوت خدمة عملاء ذكي لشركة توصيل في ليبيا تسمى "وصّل" (نغطي طرابلس وضواحيها، أوقات العمل 9 صباحاً حتى 11 ليلاً).

## هويتك ولهجتك:
- ترد بالعربية والعامية الليبية بأسلوب ودود ومهني
- تفهم المصطلحات الليبية: "خردة، رواجع، لوكيشن، فكة، حاجة، توصيلة"
- لا تخرج عن نطاق خدمات وصّل أبداً

## قواعد جمع البيانات:
- اسأل سؤالاً واحداً واضحاً في كل رسالة
- لا تعيد السؤال عن معلومات ذكرها الزبون سابقاً
- إذا كانت الرسالة غير مفهومة قل: "منور يا غالي، ابعتلي اسمك ونوع البضاعة ومكان التوصيل بالظبط عشان المندوب يتحركلك فوراً 🚗"

## رسالة الترحيب (للزبون الجديد فقط):
"👋 مرحباً بك في وصّل للتوصيل!

🚀 خدماتنا:
📦 توصيل البضائع والطرود داخل المدينة
🍔 توصيل من المطاعم
🚚 شحن بين المدن
⚡ سريع، آمن، وموثوق مية مية

⏰ أوقات العمل: 9 صباحاً - 11 ليلاً
📍 التغطية: طرابلس وضواحيها

كيف نقدر نساعدك يا غالي؟
1️⃣ تتبع طلبية
2️⃣ توصيل بضاعة
3️⃣ طلب من مطعم
4️⃣ التحدث مع الدعم"

## المسارات:

### مسار توصيل بضاعة:
اجمع: (1.الاسم → 2.رقم الهاتف → 3.نوع البضاعة → 4.من أين → 5.إلى أين → 6.السعر إن ذُكر)
بعد اكتمال البيانات: أرسل ملخصاً للتأكيد قبل الحفظ

### مسار مطعم:
اجمع: (1.اسم المطعم → 2.الطلب → 3.عنوان التوصيل → 4.رقم الهاتف)

### مسار التتبع:
اطلب رقم الطلب → ابحث في قاعدة البيانات → أخبر الزبون بالحالة الفعلية

### مسار التحويل للمدير 🚨:
في حالات: (منطقة خارج التغطية، شكوى غاضبة، طلب عاجل طارئ، مشكلة مالية معقدة، "أريد موظف إنساني")
قل: "تم تحويلك لأحد المختصين، سيتواصل معك قريباً ⏳"

### الطوارئ ⚡:
إذا كتب كلمات مثل "عاجل، سرعة، ضروري" — ارفع أولوية الطلب

## قواعد الرد المهمة:
- ردودك قصيرة ومباشرة وودية
- استخدم إيموجي باعتدال
- إذا أكملت جمع البيانات أرجع JSON هكذا في آخر ردك:
  <<<ORDER_READY>>>
  {"order_complete":true,"customer_name":"...","phone":"...","sender":"...","package_type":"...","details":"...","destination":"...","price":0,"priority":"normal"}
  <<<END>>>
- إذا تحويل للمدير أرجع:
  <<<ESCALATE>>>
  {"escalate":true,"reason":"...","customer_name":"...","phone":"..."}
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
    let conv = await getOrCreateConversation(phone);
    const isNew = !conv.messages || conv.messages.length === 0;

    // ── فحص timeout (10 دقائق)
    const lastMsg = new Date(conv.last_message_at);
    const minutesSince = (Date.now() - lastMsg) / 60000;
    let timeoutMsg = null;
    if (!isNew && minutesSince > 60) {
      // أكثر من ساعة — ابدأ من جديد
      conv.messages = [];
      conv.current_step = "welcome";
      conv.draft_order = {};
    } else if (!isNew && minutesSince > 10 && conv.current_step !== "welcome" && Object.keys(conv.draft_order || {}).length > 0) {
      timeoutMsg = "مرحباً! 👋 هل تريد:\n1️⃣ كمّل طلبك السابق\n2️⃣ ابدأ طلب جديد";
    }

    // ── بناء تاريخ المحادثة لـ Gemini
    const history = (conv.messages || []).slice(-10); // آخر 10 رسائل فقط

    const geminiMessages = [
      { role: "system", content: SYSTEM_PROMPT.replace("وصّل", companyName) },
      ...history,
      { role: "user", content: message }
    ];

    // ── استدعاء Gemini
    const reply = await callGemini(geminiMessages);

    // ── تحديث تاريخ المحادثة
    const updatedMessages = [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content: reply }
    ];

    // ── فحص إذا اكتمل الطلب
    let orderSaved = false;
    let escalate = false;
    let orderData = null;

    const orderMatch = reply.match(/<<<ORDER_READY>>>([\s\S]*?)<<<END>>>/);
    const escalateMatch = reply.match(/<<<ESCALATE>>>([\s\S]*?)<<<END>>>/);

    if (orderMatch) {
      try {
        orderData = JSON.parse(orderMatch[1].trim());
        const genId = () => "W-" + Date.now().toString().slice(-6);
        const now = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };

        await saveOrder({
          order_id:     genId(),
          customer_name: orderData.customer_name || null,
          client_phone:  orderData.phone || phone,
          sender:        orderData.sender || "غير محدد",
          package_type:  orderData.package_type || "طرود عامة",
          details:       orderData.details || message,
          destination:   orderData.destination || "غير محدد",
          price:         orderData.price || 0,
          status:        orderData.priority === "urgent" ? "عاجل" : "جديد",
          driver_name:   null,
          source:        "bot",
          date:          new Date().toISOString().split("T")[0],
          time:          now(),
          needs_manual_review: false,
        });
        orderSaved = true;

        // إعادة تعيين المحادثة بعد اكتمال الطلب
        await updateConversation(phone, {
          messages: [],
          current_step: "welcome",
          draft_order: {},
          last_message_at: new Date().toISOString()
        });
      } catch(e) {
        console.error("Order save error:", e);
      }
    } else if (escalateMatch) {
      try {
        const escData = JSON.parse(escalateMatch[1].trim());
        escalate = true;
        await updateConversation(phone, {
          messages: updatedMessages,
          current_step: "escalated",
          last_message_at: new Date().toISOString()
        });
      } catch(e) {}
    } else {
      // استمرار المحادثة العادية
      await updateConversation(phone, {
        messages: updatedMessages,
        current_step: "in_progress",
        last_message_at: new Date().toISOString()
      });
    }

    // ── تنظيف الرد من العلامات الخاصة
    const cleanReply = reply
      .replace(/<<<ORDER_READY>>>[\s\S]*?<<<END>>>/g, "")
      .replace(/<<<ESCALATE>>>[\s\S]*?<<<END>>>/g, "")
      .trim();

    return res.status(200).json({
      reply: timeoutMsg || cleanReply,
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
      escalate: false,
      needs_manual_review: true,
      raw_message: message,
    });
  }
}
