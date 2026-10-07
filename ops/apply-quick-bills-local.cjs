const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
if (!process.env.DATABASE_URL?.includes("localhost:5433/junto_db")) throw new Error("Only the local JUNTO QA database is allowed");
const db = new PrismaClient();
const sql = ["20261006-cuentas-rapidas.sql", "20261006-cuentas-progreso.sql"].map((file) => fs.readFileSync(path.join(__dirname, "sql", file), "utf8")).join("\n");
async function apply() {
  await db.$transaction(async (tx) => {
    for (const statement of sql.split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);
  });
  console.log("Local quick-bills additive migration applied. Existing data preserved.");
}
apply().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
