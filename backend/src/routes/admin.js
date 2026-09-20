import * as resourceController from "../controllers/resources.js";
import { Router } from "express";

import { authenticated } from "../middleware/auth.js";
import { resources } from "../config/resources.js";

import { assert } from "../utils/errors.js";

import access from "./admin-access.js";
import operations from "./admin-operations.js";
import content from "./admin-content.js";
import v2 from "./v2-admin.js";
const r = Router();
r.use(authenticated);
r.use(v2);
r.use(access);
r.use(operations);
r.use(content);
r.use("/:resource", (req, res, next) => {
  const resource = resources[req.params.resource];
  assert(resource, "Resource not found.", 404);
  req.resource = resource;
  req.resourceKey = req.params.resource;
  next();
});
r.get("/:resource", resourceController.list);
r.get("/:resource/:id", resourceController.detail);
r.post("/:resource", resourceController.create);
r.put("/:resource/:id", resourceController.update);
r.delete("/:resource/:id", resourceController.remove);
r.post("/:resource/:id/duplicate", resourceController.duplicate);
export default r;
