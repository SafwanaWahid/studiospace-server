import { ObjectId } from "mongodb";
import { client, studios, bookings } from "../db.js";
import { HttpError, bookingTimes, overlapQuery } from "../domain.js";
import { protect, session, objectId } from "../security.js";
export function bookingRoutes(app) {
  app.post("/api/bookings", ...protect, async (req, res) => {
    const times = bookingTimes(req.body);
    const studioId = String(objectId(req.body.studioId));
    let record;
    const tx = client.startSession();
    try {
      await tx.withTransaction(async () => {
        const studio = await studios.findOneAndUpdate(
          { _id: new ObjectId(studioId) },
          { $inc: { bookingVersion: 1 } },
          { session: tx, returnDocument: "after" },
        );
        if (!studio) throw new HttpError(404, "Studio not found.");
        if (studio.ownerEmail === req.user.email)
          throw new HttpError(400, "Choose another host’s studio to book.");
        if (
          await bookings.findOne(
            overlapQuery(studioId, times.start, times.end),
            {
              session: tx,
            },
          )
        )
          throw new HttpError(
            409,
            "These hours overlap a confirmed booking. Choose another time.",
          );
        record = {
          studioId,
          studioTitle: studio.title,
          studioImage: studio.images[0],
          location: studio.location,
          ownerEmail: studio.ownerEmail,
          userId: req.user.id,
          userEmail: req.user.email,
          userName: req.user.name,
          start: times.start,
          end: times.end,
          hours: times.hours,
          hourlyRate: studio.hourlyRate,
          deposit: studio.deposit,
          total:
            Math.round(times.hours * studio.hourlyRate * 100) / 100 +
            studio.deposit,
          status: "Pending",
          createdAt: new Date(),
        };
        const result = await bookings.insertOne(record, { session: tx });
        record._id = result.insertedId;
      });
    } finally {
      await tx.endSession();
    }
    res.status(201).json(record);
  });
  app.get("/api/bookings", session, async (req, res) => {
    const query =
      req.query.host === "true"
        ? { ownerEmail: req.user.email }
        : { userId: req.user.id };
    const records = await bookings
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    res.json(
      records.map((record) => ({
        ...record,
        canComplete: record.status === "Confirmed" && +record.end <= Date.now(),
      })),
    );
  });
  app.patch("/api/bookings/:id", ...protect, async (req, res) => {
    const tx = client.startSession();
    try {
      await tx.withTransaction(async () => {
        const booking = await bookings.findOne(
          { _id: objectId(req.params.id) },
          { session: tx },
        );
        if (!booking) throw new HttpError(404, "Booking not found.");
        const target = req.body.status;
        if (target === "Cancelled") {
          if (
            booking.userId !== req.user.id &&
            booking.ownerEmail !== req.user.email
          )
            throw new HttpError(403, "You cannot change this booking.");
          if (booking.status !== "Pending")
            throw new HttpError(409, "Only pending bookings can be cancelled.");
        } else {
          if (booking.ownerEmail !== req.user.email)
            throw new HttpError(403, "Only the host can do this.");
          if (target === "Confirmed") {
            if (booking.status !== "Pending" || +booking.start <= Date.now())
              throw new HttpError(
                409,
                "Only future pending bookings can be confirmed.",
              );
            const studio = await studios.findOneAndUpdate(
              { _id: new ObjectId(booking.studioId) },
              { $inc: { bookingVersion: 1 } },
              { session: tx, returnDocument: "after" },
            );
            if (!studio)
              throw new HttpError(404, "Studio no longer available.");
            if (
              await bookings.findOne(
                overlapQuery(booking.studioId, booking.start, booking.end),
                { session: tx },
              )
            )
              throw new HttpError(
                409,
                "A confirmed booking already occupies these hours.",
              );
          } else if (target === "Completed") {
            if (booking.status !== "Confirmed" || +booking.end > Date.now())
              throw new HttpError(
                409,
                "Complete a confirmed booking after its end time.",
              );
          } else throw new HttpError(400, "Invalid booking status.");
        }
        const result = await bookings.updateOne(
          { _id: booking._id, status: booking.status },
          { $set: { status: target, updatedAt: new Date() } },
          { session: tx },
        );
        if (!result.modifiedCount)
          throw new HttpError(409, "Booking changed. Refresh and try again.");
      });
    } finally {
      await tx.endSession();
    }
    res.json({ success: true });
  });
}
