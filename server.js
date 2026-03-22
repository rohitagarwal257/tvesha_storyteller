/**
 * Serves the static storytelling site (stories live in preloaded-stories.js).
 */
require("dotenv").config();

const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Storytelling by Tvesha → http://localhost:${PORT}`);
});
