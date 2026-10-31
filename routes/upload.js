import { HttpError } from "../domain.js";
import { protect } from "../security.js";
export function uploadRoutes(app) {
  app.post("/api/upload", ...protect, async (req, res) => {
    if (!process.env.IMGBB_API_KEY)
      throw new HttpError(
        503,
        "Add IMGBB_API_KEY to the server environment to enable uploads.",
      );
    if (
      typeof req.body.image !== "string" ||
      !/^[A-Za-z0-9+/=]+$/.test(req.body.image) ||
      req.body.image.length > 7000000
    )
      throw new HttpError(
        400,
        "Upload a JPG, PNG, or WebP image smaller than 5 MB.",
      );
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(process.env.IMGBB_API_KEY)}`,
      {
        method: "POST",
        body: new URLSearchParams({ image: req.body.image }),
        signal: AbortSignal.timeout(30000),
      },
    );
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new HttpError(502, "Image upload failed. Please try again.");
    res.json({ url: data.data.url });
  });
}
