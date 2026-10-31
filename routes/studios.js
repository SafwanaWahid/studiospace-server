import { client, db, studios, bookings } from "../db.js";
import { HttpError, studioInput } from "../domain.js";
import { protect, session, objectId } from "../security.js";
export function studioRoutes(app) {
  app.get("/api/studios", async (req, res) => {
    const query = {};
    if (req.query.category) query.category = String(req.query.category);
    if (req.query.search)
      query.$or = ["title", "location"].map((key) => ({
        [key]: {
          $regex: String(req.query.search)
            .slice(0, 100)
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        },
      }));
    const sort =
      req.query.sort === "price-low"
        ? { hourlyRate: 1 }
        : req.query.sort === "price-high"
          ? { hourlyRate: -1 }
          : { createdAt: -1 };
    const cursor = studios.find(query).sort(sort);
    res.json(
      await (
        req.query.featured === "true" ? cursor.limit(6) : cursor
      ).toArray(),
    );
  });
  app.get("/api/my-listings", session, async (req, res) =>
    res.json(
      await studios
        .find({ ownerEmail: req.user.email })
        .sort({ createdAt: -1 })
        .toArray(),
    ),
  );
  app.get("/api/studios/:id", async (req, res) => {
    const studio = await studios.findOne({ _id: objectId(req.params.id) });
    if (!studio) throw new HttpError(404, "Studio not found.");
    const availability = await bookings
      .find({
        studioId: String(studio._id),
        status: "Confirmed",
        end: { $gt: new Date() },
      })
      .project({ start: 1, end: 1, _id: 0 })
      .toArray();
    const reviews = await db
      .collection("reviews")
      .find({ studioId: String(studio._id) })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();
    res.json({ ...studio, availability, reviews });
  });
  app.post("/api/studios", ...protect, async (req, res) => {
    const value = {
      ...studioInput(req.body),
      ownerId: req.user.id,
      ownerEmail: req.user.email,
      ownerName: req.user.name,
      ownerImage: req.user.image || "",
      rating: 0,
      reviewCount: 0,
      bookingVersion: 0,
      createdAt: new Date(),
    };
    const result = await studios.insertOne(value);
    res.status(201).json({ ...value, _id: result.insertedId });
  });
  app.patch("/api/studios/:id", ...protect, async (req, res) => {
    const result = await studios.updateOne(
      { _id: objectId(req.params.id), ownerEmail: req.user.email },
      { $set: { ...studioInput(req.body), updatedAt: new Date() } },
    );
    if (!result.matchedCount)
      throw new HttpError(404, "Studio not found or you do not own it.");
    res.json({ success: true });
  });
  app.delete("/api/studios/:id", ...protect, async (req, res) => {
    const tx = client.startSession();
    try {
      await tx.withTransaction(async () => {
        const studio = await studios.findOneAndUpdate(
          { _id: objectId(req.params.id), ownerEmail: req.user.email },
          { $inc: { bookingVersion: 1 } },
          { session: tx, returnDocument: "after" },
        );
        if (!studio)
          throw new HttpError(404, "Studio not found or you do not own it.");
        if (
          await bookings.findOne(
            {
              studioId: req.params.id,
              status: "Confirmed",
              end: { $gt: new Date() },
            },
            { session: tx },
          )
        )
          throw new HttpError(
            409,
            "This studio has upcoming confirmed bookings. Complete them before deleting.",
          );
        await studios.deleteOne({ _id: studio._id }, { session: tx });
        await bookings.updateMany(
          { studioId: req.params.id, status: "Pending" },
          { $set: { status: "Cancelled" } },
          { session: tx },
        );
      });
    } finally {
      await tx.endSession();
    }
    res.json({ success: true });
  });
}
