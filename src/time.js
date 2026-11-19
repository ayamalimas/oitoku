function sameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function timePart(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function placedTimeLabel(dateString, now = new Date()) {
  const placed = new Date(dateString);
  if (Number.isNaN(placed.getTime())) return "";
  if (sameDay(placed, now)) return `今日 ${timePart(placed)}に置いた`;

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(placed, yesterday)) return `昨日 ${timePart(placed)}に置いた`;

  const datePart = placed.getFullYear() === now.getFullYear()
    ? `${placed.getMonth() + 1}/${placed.getDate()}`
    : `${placed.getFullYear()}/${placed.getMonth() + 1}/${placed.getDate()}`;
  return `${datePart} ${timePart(placed)}に置いた`;
}
