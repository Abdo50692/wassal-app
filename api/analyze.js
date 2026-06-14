export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, companyName } = req.body || {};

  if (!message) return res.status(400).json({ error: "No message provided" });

  const prompt = `أنت مساعد ذكي لشركة توصيل بضائع وشحنات في ليبيا تسمى "${companyName || "وصّل"}".
وظيفتك استقبال رسائل الزبائن المكتوبة بالعامية الليبية أو العربية وتفكيكها فوراً إلى كائن JSON فقط بدون أي مقدمات أو نصوص إضافية أو backticks.

الحقول المطلوبة:
{
  "understood": true,
  "customer_name": "اسم الزبون أو null",
  "phone": "رقم الهاتف أو null",
  "sender": "اسم المحل أو منطقة الشحن",
  "package_type": "نوع البضاعة: ملابس، لحوم، مواد غذائية، شحنات، إلخ",
  "details": "تفاصيل الطلب بالكامل",
  "destination": "العنوان أو مكان التوصيل أو null",
  "price": 0,
  "missing": ["الحقول الضرورية الناقصة فقط من: sender, destination"],
  "reply": "رد قصير ودي بالعامية الليبية"
}

قواعد:
- أول اسم = customer_name
- الأرقام الطويلة = phone
- اسم المحل أو المكان الذي تُشحن منه = sender
- مكان التسليم = destination
- اقبل الطلب إذا توفر sender و destination حتى لو ناقص بعض التفاصيل
- الرد يكون ودي وبالعامية الليبية

رسالة الزبون:
${message}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://wassal-app.vercel.app",
        "X-Title": "Wassal Delivery Bot",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    try {
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      return res.status(200).json(parsed);
    } catch {
      // فشل تحليل JSON — احفظ الرسالة الخام للمراجعة اليدوية
      return res.status(200).json({
        understood: false,
        raw_message: message,
        needs_manual_review: true,
        reply: "تم استلام طلبك ✅ سيتواصل معك فريقنا قريباً لتأكيد التفاصيل.",
      });
    }
  } catch (error) {
    // فشل الاتصال — لا يضيع الزبون
    return res.status(200).json({
      understood: false,
      raw_message: message,
      needs_manual_review: true,
      reply: "تم استلام طلبك ✅ سيتواصل معك فريقنا قريباً لتأكيد التفاصيل.",
    });
  }
}
