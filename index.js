require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================= BASIC CONFIG =================
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_URL;
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP;

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.status(200).send("CoachFlow WhatsApp Bot is running 🚀");
});

// ================= USER STATE =================
const userState = {};

// ================= WEBHOOK VERIFY =================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ================= RECEIVE MESSAGE =================
app.post("/webhook", async (req, res) => {
  try {
    const msg =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!msg || !msg.text) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text.body.trim().toLowerCase();

    console.log("📩 MESSAGE:", text);

    // ================= KEYWORD AUTO REPLIES =================
    const keywords = {
      fees: "💰 Fees Details:\nSSC: ₹10,000\nBanking: ₹12,000\nRailway: ₹8,000",
      demo: "🎓 Demo class available.\nReply *YES* to book a demo.",
      address: "📍 Address:\nABC Coaching Institute\nMain Road, Delhi",
      timing: "⏰ Class Timings:\nMorning: 7 AM\nEvening: 6 PM",
      contact: "📞 Contact:\nCall or WhatsApp: 9XXXXXXXXX",
    };

    if (keywords[text]) {
      await sendMessage(from, keywords[text]);
      return res.sendStatus(200);
    }

    // ================= USER FLOW =================
    if (!userState[from]) {
      userState[from] = { step: "ASK_NAME" };
      await sendMessage(from, "👋 Welcome!\nPlease tell me your *Name*:");
      return res.sendStatus(200);
    }

    const state = userState[from];

    if (state.step === "ASK_NAME") {
      state.name = text;
      state.step = "ASK_EXAM";
      await sendMessage(
        from,
        "📚 Which exam are you preparing for?\nSSC / Banking / Railway / NDA"
      );
    }

    else if (state.step === "ASK_EXAM") {
      state.exam = text;
      state.step = "ASK_PHONE";
      await sendMessage(from, "📞 Please share your *Phone Number*:");
    }

    else if (state.step === "ASK_PHONE") {
      state.phone = text;

      // ===== SAVE TO GOOGLE SHEET =====
      await axios.post(GOOGLE_SHEET_URL, {
        name: state.name,
        exam: state.exam,
        phone: state.phone,
        whatsapp: from,
      });

      // ===== ADMIN NOTIFICATION =====
      const adminMsg =
`🔔 New WhatsApp Enquiry

👤 Name: ${state.name}
📚 Exam: ${state.exam}
📞 Phone: ${state.phone}
📲 WhatsApp: ${from}`;

      if (ADMIN_WHATSAPP) {
        await sendMessage(ADMIN_WHATSAPP, adminMsg);
      }

      delete userState[from];

      await sendMessage(
        from,
        "✅ Thank you!\nYour enquiry has been saved.\nOur team will contact you shortly."
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    res.sendStatus(200);
  }
});

// ================= SEND MESSAGE FUNCTION =================
async function sendMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
