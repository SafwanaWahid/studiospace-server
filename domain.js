export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const categories = [
  "Photo Studio",
  "Film Stage",
  "Podcast Lounge",
  "Music Suite",
  "Workshop",
];
export const passwordValid = (value) =>
  typeof value === "string" &&
  value.length >= 6 &&
  value.length <= 128 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value);
export function safeImage(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}
export function studioInput(body) {
  const text = (key, min, max) => {
    if (
      typeof body[key] !== "string" ||
      body[key].trim().length < min ||
      body[key].trim().length > max
    )
      throw new HttpError(400, `${key} must contain ${min}–${max} characters.`);
    return body[key].trim();
  };
  const number = (key, min, max) => {
    if (
      body[key] === "" ||
      body[key] === null ||
      body[key] === undefined ||
      typeof body[key] === "boolean"
    )
      throw new HttpError(400, `${key} is required.`);
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value < min || value > max)
      throw new HttpError(400, `${key} must be between ${min} and ${max}.`);
    return value;
  };
  const title = text("title", 3, 120);
  const location = text("location", 3, 200);
  const overview = text("overview", 30, 6000);
  if (!categories.includes(body.category))
    throw new HttpError(400, "Choose a valid studio category.");
  if (
    !Array.isArray(body.images) ||
    body.images.length < 1 ||
    body.images.length > 8 ||
    !body.images.every(safeImage)
  )
    throw new HttpError(400, "Add 1–8 valid image URLs.");
  if (
    !Array.isArray(body.amenities) ||
    body.amenities.length > 30 ||
    body.amenities.some((x) => typeof x !== "string" || x.length > 80)
  )
    throw new HttpError(400, "Invalid amenities.");
  const capacity = number("capacity", 1, 1000);
  if (!Number.isInteger(capacity))
    throw new HttpError(400, "Capacity must be a whole number.");
  return {
    title,
    location,
    overview,
    category: body.category,
    hourlyRate: number("hourlyRate", 1, 100000),
    deposit: number("deposit", 0, 100000),
    capacity,
    images: body.images,
    amenities: [...new Set(body.amenities)],
  };
}
export function bookingTimes(body, now = Date.now()) {
  const start = new Date(body.start);
  const end = new Date(body.end);
  if (
    !body.start ||
    !body.end ||
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    +start <= now ||
    +end <= +start ||
    +end - +start > 86400000
  )
    throw new HttpError(
      400,
      "Choose a future booking lasting up to 24 hours. End must be after start.",
    );
  return { start, end, hours: (+end - +start) / 3600000 };
}
export const overlapQuery = (studioId, start, end) => ({
  studioId,
  status: "Confirmed",
  start: { $lt: end },
  end: { $gt: start },
});
