export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message, companyName } = req.body;

    const system = `أنت مساعد ذكي لشركة توصيل بضائع وشحنات في ليبيا تسمى "${companyName || "وصّل"}".
وظيفتك استقبال رسائل الزبائن المكتوبة بالعامية الليبية أو العربية وتفكيكها فوراً إلى كائن JSON فقط بدون أي مقدمات أو نصوص إضافية:
{
  "understood": true,
  "customer_name": "اسم الزبون أو null",
  "phone": "رقم الهاتف أو null",
  "sender": "اسم المحل أو منطقة الشحن",
  "package_type": "نوع البضاعة: ملابس، لحوم، مواد غذائية، إلخ",
  "details": "تفاصيل الطلب بالكامل",
  "destination": "العنوان أو مكان التوصيل أو null",
  "price": 0,
  "missing": ["الحقول الضرورية الناقصة فقط: sender, destination"],
  "reply": "رد قصير ودي بالعامية الليبية — إذا اكتمل الطلب رحّب وأكّد، إذا ناقص اسأل فقط عن الناقص"
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        system,
        messages: [{ role: "user", content: `رسالة الزبون:\n${message}` }],
      }),
    });

    const data = await response.json();
    const text = data.content?.map((c) => c.text || "").join("") || "";

    try {
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      return res.status(200).json(parsed);
    } catch {
      // إذا فشل التحليل — أرجع النص الخام للمراجعة اليدوية
      return res.status(200).json({
        understood: false,
        raw_message: message,
        needs_manual_review: true,
        reply: "تم استلام طلبك ✅ سيتواصل معك فريقنا قريباً لتأكيد التفاصيل.",
      });
    }
  } catch (error) {
    // في حالة فشل الاتصال بالكامل — لا يضيع الزبون
    return res.status(200).json({
      understood: false,
      raw_message: req.body?.message || "",
      needs_manual_review: true,
      reply: "تم استلام طلبك ✅ سيتواصل معك فريقنا قريباً لتأكيد التفاصيل.",
    });
  }
}
