function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}

function getGuestKey(row) {
  return row.phone_normalized ? `phone:${row.phone_normalized}` : `response:${row.id}`;
}

function buildDashboardRows(rows, includeDuplicates) {
  const counts = new Map();
  for (const row of rows) {
    const key = getGuestKey(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = getGuestKey(row);
    const isLatest = !seen.has(key);
    seen.add(key);
    if (!includeDuplicates && !isLatest) continue;

    result.push({
      id: String(row.id),
      name: row.name,
      phone: row.phone,
      attending: row.attending,
      createdAt: row.created_at,
      duplicateCount: counts.get(key) - 1,
      isDuplicate: !isLatest
    });
  }
  return result;
}

function getResponseStats(rows) {
  const uniqueGuests = new Set(rows.map(getGuestKey));
  const attendingYes = rows.filter(row => row.attending === "Yes").length;
  return {
    totalResponses: rows.length,
    uniqueGuests: uniqueGuests.size,
    duplicateResponses: rows.length - uniqueGuests.size,
    attendingYes,
    attendingNo: rows.length - attendingYes
  };
}

module.exports = { buildDashboardRows, getResponseStats, getGuestKey, normalizePhone };
