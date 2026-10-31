import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { HttpError } from "./domain.js";
import { origin } from "./config.js";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 15 * 60 * 1000,
};
const objectId = (value) => {
  if (!/^[a-f\d]{24}$/i.test(value || ""))
    throw new HttpError(400, "Invalid record ID.");
  return new ObjectId(value);
};
async function session(req, res, next) {
  const data = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!data) throw new HttpError(401, "Please log in to continue.");
  req.user = data.user;
  next();
}
function sameOrigin(req, res, next) {
  if (req.headers.origin !== origin)
    throw new HttpError(403, "Request origin is not allowed.");
  next();
}
function access(req, res, next) {
  try {
    const token = jwt.verify(
      req.cookies.studio_access,
      process.env.JWT_SECRET,
      {
        algorithms: ["HS256"],
        issuer: "studiospace",
        audience: "studiospace-api",
      },
    );
    if (token.sub !== req.user.id) throw new Error("Session changed");
    next();
  } catch {
    throw new HttpError(401, "Access expired. Please retry.");
  }
}
const protect = [sameOrigin, session, access];

export { cookieOptions, objectId, session, sameOrigin, protect };
