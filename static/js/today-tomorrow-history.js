// static/js/today-tomorrow-history.js
// Only accepts exact "14 Feb 1825" dates. Drops everything else.

function parseExactDMY(dateText) {
  if (!dateText) return null;
  const s = String(dateText).trim();
  if (!s) return null;

  // Drop fuzzy/partial outright
  if (/^(abt\.?|about|bef\.?|before|aft\.?|after|circa|ca\.?)\b/i.test(s)) return null;
  if (/^[A-Za-z]{3,9}\s+\d{3,4}$/.test(s)) return null; // "May 1892"
  if (/^\d{3,4}$/.test(s)) return null;                 // "1894"

  const months = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };

  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{3,4})$/);
  if (!m) return null;

  const day = Number(m[1]);
  const monRaw = m[2].toLowerCase();
  const month = months[monRaw] ?? months[monRaw.slice(0, 3)];
  const year = Number(m[3]);

  if (!month || !(day >= 1 && day <= 31) || !(year >= 0)) return null;
  return { month, day, year };
}

function personDisplayName(p) {
  const parts = [p.firstName, p.middleName, p.lastName].filter(Boolean);
  return (parts.join(" ").trim()) || p.id || "Unknown";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mdKey(month, day) {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function collectTodayTomorrowSentences(data) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayKey = mdKey(today.getMonth() + 1, today.getDate());
  const tomorrowKey = mdKey(tomorrow.getMonth() + 1, tomorrow.getDate());

  const todaySentences = [];
  const tomorrowSentences = [];

  const pushIfMatch = (md, sentence) => {
    const key = mdKey(md.month, md.day);
    if (key === todayKey) todaySentences.push(sentence);
    if (key === tomorrowKey) tomorrowSentences.push(sentence);
  };

  for (const gen of (data.generations || [])) {
    for (const p of (gen.persons || [])) {
      const name = personDisplayName(p);

      // Birth
      const b = parseExactDMY(p.birth?.date);
      if (b) {
        pushIfMatch(b, `${name} was born in ${b.year}.`);
      }

      // Death
      const d = parseExactDMY(p.death?.date);
      if (d) {
        pushIfMatch(d, `${name} died in ${d.year}.`);
      }

      // Marriage (anniversary)
      for (const m of (p.marriages || [])) {
        if (!m) continue;
        const md = parseExactDMY(m.marriageDate);
        if (!md) continue;

        const spouse = m.spouseName || "Unknown";
        pushIfMatch(md, `${name} married ${spouse} in ${md.year}.`);
      }
    }
  }

  // Optional: de-dup + stable sort (Birth, Marriage, Death)
  // Sorting is a little heuristic since sentences are strings—good enough for a highlight box.
  const uniq = (arr) => Array.from(new Set(arr));
  return {
    today: uniq(todaySentences),
    tomorrow: uniq(tomorrowSentences),
  };
}

function renderSentenceList(listEl, sentences) {
  listEl.innerHTML = "";

  if (!sentences || sentences.length === 0) {
    const li = document.createElement("li");
    li.className = "highlight-item";
    li.textContent = "[No recorded Event]";
    listEl.appendChild(li);
    return;
  }

  for (const s of sentences) {
    const li = document.createElement("li");
    li.className = "highlight-item";
    li.innerHTML = escapeHtml(s);
    listEl.appendChild(li);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("static/data/family-data.json", { cache: "no-store" });
    if (!res.ok) return;

    const data = await res.json();
    const { today, tomorrow } = collectTodayTomorrowSentences(data);

    const box = document.getElementById("history-highlight");
    const todayList = document.getElementById("history-today-list");
    const tomorrowList = document.getElementById("history-tomorrow-list");

    if (!box || !todayList || !tomorrowList) return;

    renderSentenceList(todayList, today);
    renderSentenceList(tomorrowList, tomorrow);

    // Show box even if both are "no recorded event" (since you asked to print that)
    box.hidden = false;
  } catch {
    // fail quietly
  }
});
