import { CATEGORIES, daysFromToday, parseDump } from "./parser.js";
import { placedTimeLabel } from "./time.js";

const STORAGE_KEY = "oitoku.v1";
const initialState = { activeResume: null, items: [], archivedResumes: [] };
let state = load();

const form = document.querySelector("#capture-form");
const input = document.querySelector("#dump-input");
const notice = document.querySelector("#notice");
const resumeCard = document.querySelector("#resume-card");
const emptyTemplate = document.querySelector("#empty-resume-template");
const deadlineSection = document.querySelector("#deadline-section");
const deadlineList = document.querySelector("#deadline-list");
const shoppingDetails = document.querySelector("#shopping-details");
const shoppingList = document.querySelector("#shopping-list");
const shoppingCount = document.querySelector("#shopping-count");
const feelingsDetails = document.querySelector("#feelings-details");
const feelingsList = document.querySelector("#feelings-list");
const feelingsCount = document.querySelector("#feelings-count");
const storedList = document.querySelector("#stored-list");
const storedCount = document.querySelector("#stored-count");

function load() {
  try {
    return { ...initialState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...initialState };
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dueLabel(dateString) {
  const days = daysFromToday(dateString);
  if (days < 0) return `${Math.abs(days)}日過ぎています`;
  if (days === 0) return "今日まで";
  if (days === 1) return "明日まで";
  const [, month, day] = dateString.split("-");
  return `${Number(month)}/${Number(day)}まで`;
}

function renderResume() {
  if (!state.activeResume) {
    resumeCard.replaceChildren(emptyTemplate.content.cloneNode(true));
    return;
  }
  const resume = state.activeResume;
  resumeCard.innerHTML = `
    <article class="resume-card">
      <p class="resume-main">${escapeHtml(resume.text)}</p>
      ${resume.createdAt ? `<p class="placed-at">${placedTimeLabel(resume.createdAt)}</p>` : ""}
      ${resume.nextAction ? `<p class="resume-next"><span>その次</span>${escapeHtml(resume.nextAction)}</p>` : ""}
      <div class="resume-actions"><button class="text-button" data-action="finish-resume">ここまでできた</button></div>
    </article>`;
}

function renderDeadlines() {
  const near = state.items
    .filter((item) => item.dueDate && daysFromToday(item.dueDate) <= 3)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
  deadlineSection.hidden = near.length === 0;
  deadlineList.innerHTML = near.map((item) => `
    <div class="deadline-item">
      <p>${escapeHtml(item.text)}</p>
      <time datetime="${item.dueDate}">${dueLabel(item.dueDate)}</time>
    </div>`).join("");
}

function renderShopping() {
  const shoppingItems = state.items
    .filter((item) => item.category === "shopping")
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  shoppingDetails.hidden = shoppingItems.length === 0;
  shoppingCount.textContent = String(shoppingItems.length);
  shoppingList.innerHTML = shoppingItems.map((item) => `
    <article class="shopping-item" data-id="${item.id}">
      <button class="shopping-check" data-action="bought" data-id="${item.id}" aria-label="${escapeHtml(item.text)}を買えた">✓</button>
      <div class="shopping-copy">
        <p class="item-text">${escapeHtml(item.text)}</p>
        ${item.createdAt ? `<p class="placed-at">${placedTimeLabel(item.createdAt)}</p>` : ""}
        ${item.dueDate ? `<div class="meta"><span class="chip due">${dueLabel(item.dueDate)}</span></div>` : ""}
      </div>
    </article>`).join("");
}

function renderFeelings() {
  const feelingItems = state.items
    .filter((item) => item.category === "feeling")
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  feelingsDetails.hidden = feelingItems.length === 0;
  feelingsCount.textContent = String(feelingItems.length);
  feelingsList.innerHTML = feelingItems.map((item) => `
    <article class="feeling-item" data-id="${item.id}">
      <p class="feeling-text">${escapeHtml(item.text)}</p>
      ${item.createdAt ? `<p class="placed-at">${placedTimeLabel(item.createdAt)}</p>` : ""}
      <div class="feeling-actions">
        <button class="release-button" data-action="release-feeling" data-id="${item.id}">もう手放す</button>
      </div>
    </article>`).join("");
}

function renderStored() {
  const storedItems = state.items.filter((item) => !["shopping", "feeling"].includes(item.category));
  storedCount.textContent = String(storedItems.length);
  if (!storedItems.length) {
    storedList.innerHTML = `<p class="stored-empty">いまは空っぽです。</p>`;
    return;
  }
  const sorted = [...storedItems].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  storedList.innerHTML = sorted.map((item) => `
    <article class="item" data-id="${item.id}">
      <div class="item-top"><p class="item-text">${escapeHtml(item.text)}</p></div>
      ${item.createdAt ? `<p class="placed-at">${placedTimeLabel(item.createdAt)}</p>` : ""}
      <div class="meta">
        <span class="chip">${CATEGORIES[item.category] || CATEGORIES.life}</span>
        ${item.dueDate ? `<span class="chip due">${dueLabel(item.dueDate)}</span>` : ""}
        ${item.calendarCandidate ? `<span class="chip calendar">${item.calendarConfirmed ? "予定候補・確認済み" : "予定候補"}</span>` : ""}
      </div>
      <div class="item-actions">
        <button data-action="promote" data-id="${item.id}">ここから戻るにする</button>
        ${item.calendarCandidate && !item.calendarConfirmed ? `<button data-action="confirm-calendar" data-id="${item.id}">予定候補を確認</button>` : ""}
        <button class="delete" data-action="delete" data-id="${item.id}">手放す</button>
      </div>
    </article>`).join("");
}

function render() {
  renderResume();
  renderDeadlines();
  renderShopping();
  renderFeelings();
  renderStored();
}

function announce(message) {
  notice.textContent = message;
  window.clearTimeout(announce.timer);
  announce.timer = window.setTimeout(() => { notice.textContent = ""; }, 3500);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const raw = input.value.trim();
  if (!raw) { input.focus(); return; }
  const parsed = parseDump(raw);
  if (parsed.resume) {
    if (state.activeResume) state.archivedResumes.push(state.activeResume);
    state.activeResume = parsed.resume;
  }
  state.items.push(...parsed.items);
  save();
  render();
  input.value = "";
  input.focus();
  announce(parsed.resume ? "復帰地点も、ここに置いておくね。" : `${parsed.items.length || 1}件、置いておきます。`);
});

input.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") form.requestSubmit();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "finish-resume") {
    if (state.activeResume?.nextAction) {
      state.activeResume = { ...state.activeResume, text: state.activeResume.nextAction, nextAction: null };
      announce("次のところを、戻る場所にしました。");
    } else {
      state.archivedResumes.push(state.activeResume);
      state.activeResume = null;
      announce("ここまで。いったん空けておきます。");
    }
  }
  if (action === "promote") {
    const item = state.items.find((entry) => entry.id === id);
    if (item) {
      if (state.activeResume) state.archivedResumes.push(state.activeResume);
      state.activeResume = { id: `resume-${item.id}`, text: item.text, nextAction: null, category: item.category, createdAt: item.createdAt || new Date().toISOString() };
      state.items = state.items.filter((entry) => entry.id !== id);
      announce("ここから戻れるように、前へ出しました。");
    }
  }
  if (action === "confirm-calendar") {
    const item = state.items.find((entry) => entry.id === id);
    if (item) item.calendarConfirmed = true;
    announce("予定候補として確認しました。カレンダーにはまだ追加していません。");
  }
  if (action === "bought") {
    state.items = state.items.filter((entry) => entry.id !== id);
    announce("買えたね。リストから外しました。");
  }
  if (action === "release-feeling") {
    state.items = state.items.filter((entry) => entry.id !== id);
    announce("もう、ここには置いておかなくて大丈夫。");
  }
  if (action === "delete") {
    state.items = state.items.filter((entry) => entry.id !== id);
    announce("手放しました。");
  }
  save();
  render();
});

render();

if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // 保存と入力は、オフライン準備に失敗しても引き続き使える。
  });
}
