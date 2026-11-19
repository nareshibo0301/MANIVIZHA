function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}

function buildDashboardRows(rows, includeDuplicates) {
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.phone_normalized, (counts.get(row.phone_normalized) || 0) + 1);
  }

  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const isLatest = !seen.has(row.phone_normalized);
    seen.add(row.phone_normalized);
    if (!includeDuplicates && !isLatest) continue;

    result.push({
      id: String(row.id),
      name: row.name,
      phone: row.phone,
      attending: row.attending,
      createdAt: row.created_at,
      duplicateCount: counts.get(row.phone_normalized) - 1,
      isDuplicate: !isLatest
    });
  }
  return result;
}

function getResponseStats(rows) {
  const uniquePhones = new Set(rows.map(row => row.phone_normalized));
  const attendingYes = rows.filter(row => row.attending === "Yes").length;
  return {
    totalResponses: rows.length,
    uniqueGuests: uniquePhones.size,
    duplicateResponses: rows.length - uniquePhones.size,
    attendingYes,
    attendingNo: rows.length - attendingYes
  };
}

module.exports = { buildDashboardRows, getResponseStats, normalizePhone };
