const { hasAdminSession, sameOrigin } = require("../_auth");
const { json, methodNotAllowed } = require("../_http");

const REPOSITORY = "nareshibo0301/MANIVIZHA";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const IMAGES = {
  tamil: { path: "TAMIL.png", label: "Tamil" },
  english: { path: "ENGLISH.png", label: "English" }
};

function decodePng(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Choose a PNG image to upload.");
  }
  if (value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
    throw new Error("The image must be no larger than 3 MB.");
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("The uploaded image is not valid base64 data.");
  }

  const image = Buffer.from(value, "base64");
  if (image.length > MAX_IMAGE_BYTES) {
    throw new Error("The image must be no larger than 3 MB.");
  }
  if (image.toString("base64") !== value || image.length < PNG_SIGNATURE.length ||
      !image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("The uploaded file must be a valid PNG image.");
  }
  return image;
}

async function githubRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Manivizha-admin",
      ...options.headers
    }
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = new Error(`GitHub returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!sameOrigin(req)) return json(res, 403, { error: "Request origin is not allowed." });

  try {
    if (!hasAdminSession(req)) return json(res, 401, { error: "Please sign in to update invitation images." });
  } catch (error) {
    console.error("Could not verify admin session for invitation update.", error);
    return json(res, 500, { error: "Dashboard authentication is not configured." });
  }

  const language = req.body?.language;
  const target = typeof language === "string" && Object.hasOwn(IMAGES, language)
    ? IMAGES[language]
    : null;
  if (!target) return json(res, 400, { error: "Choose a valid invitation language." });

  let image;
  try {
    image = decodePng(req.body?.image);
  } catch (error) {
    return json(res, 400, { error: error.message });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN is not configured.");
    return json(res, 503, { error: "GitHub image updates are not configured for this deployment." });
  }

  const branch = process.env.GITHUB_BRANCH || "main";
  const fileUrl = `https://api.github.com/repos/${REPOSITORY}/contents/${target.path}`;
  try {
    const current = await githubRequest(`${fileUrl}?ref=${encodeURIComponent(branch)}`, token);
    if (current && typeof current.sha !== "string") {
      throw new Error("GitHub did not return the existing image revision.");
    }

    const saved = await githubRequest(fileUrl, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Update ${target.label} invitation image from admin dashboard`,
        content: image.toString("base64"),
        branch,
        ...(current ? { sha: current.sha } : {})
      })
    });
    const commit = saved?.commit?.sha;
    if (typeof commit !== "string") throw new Error("GitHub did not confirm the image commit.");
    return json(res, 200, { ok: true, language: target.label, commit: commit.slice(0, 7) });
  } catch (error) {
    console.error("Could not commit invitation image to GitHub.", error);
    const status = error.status === 409 || error.status === 422 ? 409 : 502;
    const message = status === 409
      ? "The image changed on GitHub during this upload. Please try again."
      : "GitHub could not save the invitation image. Please try again later.";
    return json(res, status, { error: message });
  }
};
