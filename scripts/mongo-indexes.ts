import { ensureGenerationIndexes } from "../src/lib/generations";
import { ensureChatIndexes } from "../src/lib/chats";
import { getMongoClient } from "../src/lib/mongodb";

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  const names = await ensureGenerationIndexes();
  await ensureChatIndexes();
  console.log("chats: user_chat, user_recent");
  console.log("Ensured indexes on generations:", names.join(", "));

  const client = await getMongoClient();
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
