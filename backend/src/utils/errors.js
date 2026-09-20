export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const assert = (condition, message, status = 400) => {
  if (!condition) throw new HttpError(status, message);
};
export function errorHandler(error, req, res, next) {
  if (error.name === "ZodError")
    return res.status(400).json({
      error: error.issues
        .map((x) => `${x.path.join(".")}: ${x.message}`)
        .join("; "),
    });
  if (error.code === "23505")
    return res
      .status(409)
      .json({ error: "A record with this unique value already exists." });
  if (error.code === "23503" || error.code === "23001")
    return res
      .status(409)
      .json({ error: "This record is in use or references a missing record." });
  if (error.code === "23514" || error.code === "22P02")
    return res.status(400).json({ error: "Invalid field value." });
  if (error.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ error: "Images must be under 5 MB." });
  if (!error.status) console.error(error);
  res.status(error.status || 500).json({
    error: error.status ? error.message : "An unexpected error occurred.",
  });
}
