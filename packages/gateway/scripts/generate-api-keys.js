import crypto from "crypto";
import pool from "../src/db/client.js";

function generateApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

async function saveKey(key, label = "default") {
  const hash = crypto.createHash("sha256").update(key).digest("hex");

  await pool.query(
    `INSERT INTO api_keys (key_hash, label) VALUES ($1, $2)`,
    [hash, label]
  );

  console.log("API Key created:");
  console.log("🔑 Raw Key:", key);
  console.log("⚠️  Save this key now — it will NOT be shown again!");
  process.exit(0);
}

const newKey = generateApiKey();
await saveKey(newKey, process.argv[2] || "default");
