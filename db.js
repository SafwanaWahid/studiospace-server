import { MongoClient } from "mongodb";
import "./config.js";
const client = new MongoClient(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
});
await client.connect();
const db = client.db(process.env.DB_NAME || "studiospace");
const studios = db.collection("studios");
const bookings = db.collection("bookings");
const wishlists = db.collection("wishlists");
await Promise.all([
  studios.createIndex({ ownerEmail: 1 }),
  studios.createIndex({ category: 1, createdAt: -1 }),
  bookings.createIndex({ studioId: 1, status: 1, start: 1, end: 1 }),
  bookings.createIndex({ userId: 1, createdAt: -1 }),
  wishlists.createIndex({ userId: 1, studioId: 1 }, { unique: true }),
  wishlists.createIndex({ userId: 1, createdAt: -1 }),
]);

export { client, db, studios, bookings, wishlists };
