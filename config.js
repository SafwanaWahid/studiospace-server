import "dotenv/config";
for (const key of [
  "MONGODB_URI",
  "CLIENT_URL",
  "BETTER_AUTH_SECRET",
  "JWT_SECRET",
]) {
  if (!process.env[key] || process.env[key].includes("REPLACE_"))
    throw new Error(`Set ${key} in your server .env file first.`);
}
if (
  process.env.BETTER_AUTH_SECRET.length < 32 ||
  process.env.JWT_SECRET.length < 32
)
  throw new Error("Use secrets of at least 32 characters.");
const origin = new URL(process.env.CLIENT_URL).origin;

export { origin };
