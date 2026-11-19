function json(res, status, value) {
  res.status(status).json(value);
}

function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return json(res, 405, { error: "Method not allowed." });
}

module.exports = { json, methodNotAllowed };
