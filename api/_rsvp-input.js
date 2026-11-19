const { normalizePhone } = require("./_responses");

function parseRsvpInput(input) {
  if (!input || typeof input !== "object") return null;

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const normalizedPhone = normalizePhone(phone);
  const phoneValid = phone === "" ||
    (normalizedPhone.length >= 7 && normalizedPhone.length <= 15 && /^[+\d\s()-]+$/.test(phone));

  if (name.length < 2 || name.length > 120 || !phoneValid || input.attending !== "Yes") {
    return null;
  }

  return { name, phone, normalizedPhone, attending: "Yes" };
}

module.exports = { parseRsvpInput };
