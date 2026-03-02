import express from "express";

const app = express();
const PORT = 5000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("SDG 2026 Backend Running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});