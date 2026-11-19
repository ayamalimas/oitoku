export const CATEGORIES = {
  work: "仕事",
  life: "生活",
  shopping: "買い物",
  communication: "連絡",
  interest: "興味・調べもの",
  schedule: "予定",
  feeling: "気持ち"
};

const categoryRules = [
  ["feeling", /(もやもや|モヤモヤ|しんどい|つらい|辛い|悲しい|寂しい|さみしい|怖い|こわい|不安|落ち込|嫌だった|嫌だ|いやだ|悔しい|腹が立|腹立つ|むかつく|イライラ|疲れた|苦しい|泣きたい|気持ち|引っかかって|引っかかる|分かんない|わからない|嬉しい|うれしい|安心した|ほっとした)/],
  ["schedule", /(予約|予定|打ち合わせ|会議|病院|歯医者|美容院|面談|集合|訪問|出発|\d{1,2}\s*時|\d{1,2}:\d{2})/],
  ["communication", /(返信|返事|連絡|メール|電話|LINE|メッセージ|送る|伝える|聞く)/i],
  ["shopping", /(買う|買い(?:たい|に行く)?|買って|購入|注文|欲しい|ほしい|牛乳|卵|洗剤|日用品|スーパー|買い物|なくなる|切れそう)/],
  ["interest", /(調べ|気になる|見たい|読みたい|知りたい|比較|検索|研究|HERA|リップ)/i],
  ["work", /(仕事|案件|納品|締切|資料|原稿|請求|クライアント|会議|タスク|レビュー)/],
  ["life", /(片付け|掃除|洗濯|ごみ|ゴミ|料理|冷凍庫|家|薬|風呂|生活)/]
];

function iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function atMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function extractDueDate(text, now = new Date()) {
  const base = atMidnight(now);
  const relative = [
    [/明後日/, 2],
    [/明日/, 1],
    [/(今日|きょう)/, 0]
  ];
  for (const [rule, offset] of relative) {
    if (rule.test(text)) {
      const result = new Date(base);
      result.setDate(result.getDate() + offset);
      return iso(result);
    }
  }

  const full = text.match(/(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})日?/);
  if (full) return iso(new Date(Number(full[1]), Number(full[2]) - 1, Number(full[3])));

  const short = text.match(/(?:^|\D)(\d{1,2})[月/.-](\d{1,2})日?/);
  if (short) {
    let year = base.getFullYear();
    let result = new Date(year, Number(short[1]) - 1, Number(short[2]));
    if (result < base) result = new Date(year + 1, Number(short[1]) - 1, Number(short[2]));
    return iso(result);
  }

  const weekdayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const weekday = text.match(/([日月火水木金土])曜/);
  if (weekday) {
    const target = weekdayNames.indexOf(weekday[1]);
    let offset = (target - base.getDay() + 7) % 7;
    if (offset === 0 && !/(今日|きょう)/.test(text)) offset = 7;
    const result = new Date(base);
    result.setDate(result.getDate() + offset);
    return iso(result);
  }
  return null;
}

export function categorize(text) {
  return categoryRules.find(([, rule]) => rule.test(text))?.[0] || "life";
}

function clean(text) {
  return text
    .replace(/^[、,。\s]+|[、,。\s]+$/g, "")
    .replace(/^(?:あと|それと|それから)\s*/u, "")
    .replace(/^(?:今日|きょう|明日|明後日|[日月火水木金土]曜(?:日)?)(?:まで|に)?[、,\s]*/u, "")
    .replace(/^(?:\d{1,2}[月/]\d{1,2}日?)(?:まで|に)?[、,\s]*/u, "")
    .trim();
}

function cleanFeeling(text) {
  return text
    .replace(/^[、,。\s]+|[、,。\s]+$/g, "")
    .replace(/^(?:あと|それと|それから)\s*/u, "")
    .trim();
}

function splitThoughts(text) {
  return text
    .replace(/\r/g, "")
    .split(/[。！？!\n]+|[、,]\s*(?=(?:今日|きょう|明日|明後日|あと|それと|それから|今は|いまは))/u)
    .flatMap((part) => part.split(/(?:^|\s)あと(?=[一-龥ぁ-んァ-ンA-Za-z])/u))
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractFlow(raw) {
  const normalized = raw.replace(/\r?\n/g, "。 ");
  const flow = normalized.match(/(?:今は|いまは|今やって(?:いる|る)のは)\s*(.+?)(?:てて|ていて|していて|しながら)[、,\s]*(?:その)?次(?:は|に)?\s*(.+?)(?=[。！？]|$)/u);
  if (flow) return { current: clean(flow[1]), next: clean(flow[2]) };

  const simple = normalized.match(/(?:今は|いまは|今やって(?:いる|る)のは)\s*(.+?)(?=[。！？]|$)/u);
  if (!simple) return null;
  return { current: clean(simple[1]), next: null };
}

function makeId(prefix = "item") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseDump(raw, now = new Date()) {
  const text = raw.trim();
  if (!text) return { resume: null, items: [] };

  const flowCandidate = extractFlow(text);
  // 「今はつらい」のような気持ちは、復帰すべき作業へ変えない。
  const flow = flowCandidate && categorize(flowCandidate.current) !== "feeling" ? flowCandidate : null;
  const thoughts = splitThoughts(text);
  const items = [];

  for (const thought of thoughts) {
    if (flow && /^(?:今は|いまは|今やって(?:いる|る)のは)/u.test(thought)) continue;
    const category = categorize(thought);
    const itemText = category === "feeling" ? cleanFeeling(thought) : clean(thought);
    if (!itemText || itemText.length < 2) continue;
    const dueDate = category === "feeling" ? null : extractDueDate(thought, now);
    const hasTime = /(?:[01]?\d|2[0-3])(?::\d{2}|\s*時(?:\s*\d{1,2}分)?)/.test(thought);
    const calendarCandidate = category !== "feeling" && (category === "schedule" || hasTime);
    items.push({
      id: makeId(),
      text: itemText,
      category,
      dueDate,
      reminderSuggestion: dueDate ? (dueDate === iso(atMidnight(now)) ? "今日、少し前に" : "前日と当日") : null,
      calendarCandidate,
      calendarConfirmed: false,
      createdAt: now.toISOString(),
      status: "stored"
    });
  }

  // 「今は」の文しかなかった場合でも、復帰地点は必ず残す。
  const resume = flow ? {
    id: makeId("resume"),
    text: flow.current,
    nextAction: flow.next,
    category: categorize(flow.current),
    createdAt: now.toISOString()
  } : null;

  return { resume, items };
}

export function daysFromToday(dateString, now = new Date()) {
  const target = new Date(`${dateString}T00:00:00`);
  return Math.round((target - atMidnight(now)) / 86_400_000);
}
