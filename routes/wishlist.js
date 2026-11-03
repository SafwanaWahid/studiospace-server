import { studios, wishlists } from "../db.js";
import { HttpError } from "../domain.js";
import { objectId, protect, session } from "../security.js";

export function wishlistRoutes(app) {
  app.get("/api/wishlist/ids", session, async (req, res) => {
    const records = await wishlists
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .project({ studioId: 1, _id: 0 })
      .toArray();
    res.json(records.map((record) => record.studioId));
  });

  app.get("/api/wishlist", session, async (req, res) => {
    const records = await wishlists
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();
    if (!records.length) return res.json([]);

    const ids = records.map((record) => objectId(record.studioId));
    const studiosById = new Map(
      (await studios.find({ _id: { $in: ids } }).toArray()).map((studio) => [
        String(studio._id),
        studio,
      ]),
    );
    res.json(
      records
        .map((record) => studiosById.get(record.studioId))
        .filter(Boolean),
    );
  });

  app.post("/api/wishlist/:studioId", ...protect, async (req, res) => {
    const studio = await studios.findOne({ _id: objectId(req.params.studioId) });
    if (!studio) throw new HttpError(404, "Studio not found.");

    await wishlists.updateOne(
      { userId: req.user.id, studioId: String(studio._id) },
      {
        $setOnInsert: {
          userId: req.user.id,
          studioId: String(studio._id),
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
    res.status(201).json({ success: true });
  });

  app.delete("/api/wishlist/:studioId", ...protect, async (req, res) => {
    const id = String(objectId(req.params.studioId));
    await wishlists.deleteOne({ userId: req.user.id, studioId: id });
    res.json({ success: true });
  });
}
