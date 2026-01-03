const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("WhatsApp Backend Running");
});

app.post("/webhook", (req, res) => {
  console.log("Message received:", JSON.stringify(req.body));
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
