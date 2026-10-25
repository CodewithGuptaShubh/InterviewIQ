import multer from "multer";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";

export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, _req, res, _next) {
  let status = error.status || 500;
  let message = error.message || "Something went wrong";

  if (error instanceof multer.MulterError) {
    status = 400;
    message = error.code === "LIMIT_FILE_SIZE" ? "File is too large (max 5 MB)" : message;
  } else if (error instanceof mongoose.Error.CastError) {
    status = 404;
    message = "Resource not found";
  } else if (error?.code === 11000) {
    status = 409;
    message = "That record already exists";
  }

  if (status >= 500) {
    // Deliberate HttpErrors (e.g. 501 "not configured") only need a one-line log; real crashes get the stack.
    if (error instanceof HttpError) console.warn(`[error] ${status} ${message}`);
    else console.error("[error]", error);
    if (env.isProd) message = "Something went wrong";
  }

  res.status(status).json({ error: message, ...(error.details && !env.isProd ? { details: error.details } : {}) });
}
