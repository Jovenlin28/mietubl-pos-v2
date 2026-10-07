const fs = require("fs");
const path = require("path");

const endpointsDir = path.resolve(__dirname, "../endpoints");
if (!fs.existsSync(endpointsDir)) {
  console.error("endpoints dir not found:", endpointsDir);
  process.exit(1);
}

const files = fs.readdirSync(endpointsDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

const transforms = [
  // common SQLite datetime -> MySQL NOW()
  { from: /datetime\(\s*'now'\s*\)/gi, to: "NOW()" },
  // SQLite date YYYY-MM-DD functions -> DATE(NOW()) usage (example)
  { from: /date\(\s*'now'\s*\)/gi, to: "CURDATE()" },
  // SQLite CURRENT_TIMESTAMP -> MySQL CURRENT_TIMESTAMP
  { from: /CURRENT_TIMESTAMP/gi, to: "CURRENT_TIMESTAMP" },
  // sqlite string concat operator '||' -> use CONCAT() (simple replacement only; manual review recommended)
  { from: /\b([A-Za-z0-9_\.]+)\s*\|\|\s*([A-Za-z0-9_\.]+)\b/g, to: "CONCAT($1,$2)" },
  // remove PRAGMA statements if present
  { from: /PRAGMA\s+[^;]+;?/gi, to: "" },
  // convert boolean literal usage 1/0 remains fine; explicit TRUE/FALSE -> 1/0 (optional)
  { from: /\bTRUE\b/gi, to: "1" },
  { from: /\bFALSE\b/gi, to: "0" },
];

for (const f of files) {
  const filePath = path.join(endpointsDir, f);
  let src = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const t of transforms) {
    const newSrc = src.replace(t.from, t.to);
    if (newSrc !== src) {
      changed = true;
      src = newSrc;
    }
  }

  if (changed) {
    const backup = filePath + ".bak";
    fs.copyFileSync(filePath, backup);
    fs.writeFileSync(filePath, src, "utf8");
    console.log("Updated", f, "-> backup at", path.basename(backup));
  } else {
    console.log("No changes for", f);
  }
}

console.log("Conversion finished. Review changes in backend/endpoints/*.ts and remove .bak files when satisfied.");