require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_URL;

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
    const text = msg.text.body.trim();

    console.log("📩 MESSAGE:", text);

    if (!userState[from]) {
      userState[from] = { step: "ASK_NAME" };
      await send(from, "👋 Welcome!\nPlease tell me your *Name*:");
      return res.sendStatus(200);
    }

    const state = userState[from];

    if (state.step === "ASK_NAME") {
      state.name = text;
      state.step = "ASK_EXAM";
      await send(from, "📚 Which exam? (SSC / Banking / Railway / NDA)");
    }

    else if (state.step === "ASK_EXAM") {
      state.exam = text;
      state.step = "ASK_PHONE";
      await send(from, "📞 Please share your *Phone Number*:");
    }

    else if (state.step === "ASK_PHONE") {
      state.phone = text;

      await axios.post(GOOGLE_SHEET_URL, {
        name: state.name,
        exam: state.exam,
        phone: state.phone,
        whatsapp: from
      });

      delete userState[from];

      await send(
        from,
        "✅ Thank you! Your enquiry has been saved.\nOur team will contact you shortly."
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    res.sendStatus(200);
  }
});

// ================= SEND MESSAGE =================
async function send(to, text) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text }
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
