import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { origin } from "./config.js";
import { passwordValid } from "./domain.js";
import { sameOrigin, session, cookieOptions } from "./security.js";
import { studioRoutes } from "./routes/studios.js";
import { bookingRoutes } from "./routes/bookings.js";
import { uploadRoutes } from "./routes/upload.js";
import { wishlistRoutes } from "./routes/wishlist.js";
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin, credentials: true }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.post("/api/auth/sign-up/email", express.json(), (req, res, next) => {
  if (!passwordValid(req.body?.password))
    return res.status(400).json({
      message: "Password needs uppercase, lowercase, and 6–128 characters.",
    });
  const headers = fromNodeHeaders(req.headers);
  headers.set("content-type", "application/json");
  auth
    .handler(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
      }),
    )
    .then(async (response) => {
      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== "set-cookie") res.setHeader(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) res.setHeader("set-cookie", cookies);
      res.send(Buffer.from(await response.arrayBuffer()));
    })
    .catch(next);
});
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "12mb" }));
app.use(cookieParser());
app.get("/api/health", (req, res) => res.json({ status: "healthy" }));
app.post("/api/access", sameOrigin, session, (req, res) => {
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: req.user.id,
    expiresIn: "15m",
    issuer: "studiospace",
    audience: "studiospace-api",
  });
  res.cookie("studio_access", token, cookieOptions).json({ success: true });
});
app.delete("/api/access", sameOrigin, (req, res) =>
  res
    .clearCookie("studio_access", { ...cookieOptions, maxAge: undefined })
    .json({ success: true }),
);
app.get("/api/config", (req, res) =>
  res.json({
    googleEnabled: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    ),
    uploadEnabled: Boolean(process.env.IMGBB_API_KEY),
  }),
);
studioRoutes(app);
bookingRoutes(app);
wishlistRoutes(app);
uploadRoutes(app);
app.use((req, res) =>
  res.status(404).json({ message: "API route not found." }),
);
app.use((error, req, res, next) => {
  console.error(error.message);
  res.status(error.status || 500).json({
    message: error.status ? error.message : "Server error. Please try again.",
  });
});

export { app };
