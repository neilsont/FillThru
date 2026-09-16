import { ensureGenerationIndexes } from "../src/lib/generations";
import { getMongoClient } from "../src/lib/mongodb";

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  const names = await ensureGenerationIndexes();
  console.log("Ensured indexes on generations:", names.join(", "));

  const client = await getMongoClient();
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
