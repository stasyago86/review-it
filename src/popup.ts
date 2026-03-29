/// <reference types="chrome" />

const MAX_STARS = 5;
const RATING_ATTR = "data-selected-rating";
const SERVER_URL = "https://review-it-backend-587398533610.europe-west4.run.app/api/review";

let hoverRating = 0;

function getSelectedRating(container: HTMLElement): number {
  const val = container.getAttribute(RATING_ATTR);
  return val ? parseInt(val, 10) : 0;
}

function setSelectedRating(container: HTMLElement, value: number): void {
  container.setAttribute(RATING_ATTR, String(value));
}

function getEffectiveRating(container: HTMLElement, index: number): boolean {
  const current = hoverRating || getSelectedRating(container);
  return index <= current;
}

/** Update shine class on existing star nodes only (no DOM replace). */
function updateStarDisplay(container: HTMLElement): void {
  const stars = container.querySelectorAll<HTMLElement>(".star");
  stars.forEach((star, idx) => {
    const index = idx + 1;
    if (getEffectiveRating(container, index)) {
      star.classList.add("shine");
    } else {
      star.classList.remove("shine");
    }
  });
}

function initStars(container: HTMLElement): void {
  container.innerHTML = "";

  for (let i = 1; i <= MAX_STARS; i += 1) {
    const star = document.createElement("span");
    star.textContent = "★";
    star.classList.add("star");
    star.dataset.starIndex = String(i);

    star.addEventListener("mouseenter", () => {
      hoverRating = i;
      updateStarDisplay(container);
    });

    star.addEventListener("mouseleave", () => {
      hoverRating = 0;
      updateStarDisplay(container);
    });

    star.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedRating(container, i);
      hoverRating = 0;
      updateStarDisplay(container);
    });

    container.appendChild(star);
  }

  updateStarDisplay(container);
}

function closePopup() {
  window.close();
}

/** Extract page title, URL, and optional "item" (h1 or og:title) from the active tab. */
async function getPageInfo(): Promise<{
  pageTitle: string;
  pageUrl: string;
  item: string | null;
  siteLanguage: string | null;
}> {
  const fallback = { pageTitle: "", pageUrl: "", item: null as string | null, siteLanguage: null as string | null };

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://")) {
      return { ...fallback, pageTitle: tab?.title ?? "", pageUrl: tab?.url ?? "" };
    }

    const pageTitle = tab.title ?? "";
    const pageUrl = tab.url ?? "";

    let item: string | null = null;
    let siteLanguage: string | null = null;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const h1 = document.querySelector("h1");
          const ogTitle = document.querySelector('meta[property="og:title"]');
          const langAttr = document.documentElement?.getAttribute("lang")?.trim() || "";
          const metaLang =
            document.querySelector('meta[http-equiv="content-language"]')?.getAttribute("content")?.trim() ||
            document.querySelector('meta[name="language"]')?.getAttribute("content")?.trim() ||
            "";

          const siteLanguage = (langAttr || metaLang || "").trim() || null;
          const item = (h1?.textContent?.trim() ?? ogTitle?.getAttribute("content") ?? null) || null;
          return { item, siteLanguage };
        }
      });
      const r = results?.[0]?.result as { item?: string | null; siteLanguage?: string | null } | undefined;
      item = r?.item ?? null;
      siteLanguage = r?.siteLanguage ?? null;
    } catch {
      // Page may not allow scripting (e.g. chrome://); ignore
    }

    return { pageTitle, pageUrl, item, siteLanguage };
  } catch {
    return fallback;
  }
}


const FETCH_REVIEW_TIMEOUT_MS = 15_000;

async function fetchReview(payload: {
  rating: number;
  text: string;
  pageTitle: string;
  pageUrl: string;
  item: string | null;
  siteLanguage: string | null;
}): Promise<string> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_REVIEW_TIMEOUT_MS);

  try {
    const response = await fetch(SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }
    return await response.text();
  } catch (e) {
    const aborted =
      (e instanceof DOMException && e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError");
    if (aborted) {
      throw new Error(
        "Request timed out after 15 seconds. Check your connection and try again."
      );
    }
    throw e;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function setResultLoading(loading: boolean): void {
  const loadingState = document.getElementById("loading-state");
  const resultBody = document.getElementById("result-body");
  if (loadingState) loadingState.classList.toggle("hidden", !loading);
  if (resultBody) resultBody.classList.toggle("hidden", loading);
}

function showResultViewLoading(): void {
  const formView = document.getElementById("form-view");
  const resultView = document.getElementById("result-view");
  if (formView) formView.classList.add("hidden");
  if (resultView) resultView.classList.add("visible");
  setResultLoading(true);
}

function showResultView(content: string, isError: boolean): void {
  const formView = document.getElementById("form-view");
  const resultView = document.getElementById("result-view");
  const resultContent = document.getElementById("result-content");
  const copyBtn = document.getElementById("copy-btn");

  if (formView) formView.classList.add("hidden");
  if (resultView) resultView.classList.add("visible");
  setResultLoading(false);
  if (resultContent) {
    resultContent.textContent = content;
    resultContent.className = "result-text " + (isError ? "error" : "");
  }
  if (copyBtn) {
    const btn = copyBtn as HTMLButtonElement;
    btn.disabled = isError;
    btn.style.display = isError ? "none" : "";
  }
}

function showFormView(): void {
  const formView = document.getElementById("form-view");
  const resultView = document.getElementById("result-view");
  const resultBody = document.getElementById("result-body");
  const resultContent = document.getElementById("result-content");
  if (formView) formView.classList.remove("hidden");
  if (resultView) resultView.classList.remove("visible");
  setResultLoading(false);
  if (resultBody) resultBody.classList.remove("hidden");
  if (resultContent) resultContent.classList.remove("error", "loading");
  const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement | null;
  if (copyBtn) {
    copyBtn.style.display = "";
    copyBtn.disabled = false;
  }
}

async function handleFinish(starsRoot: HTMLElement) {
  const textarea = document.getElementById("review-text") as HTMLTextAreaElement | null;
  const text = textarea?.value.trim() ?? "";
  const rating = getSelectedRating(starsRoot);
  const pageInfo = await getPageInfo();

  const payload = {
    rating,
    text,
    pageTitle: pageInfo.pageTitle,
    pageUrl: pageInfo.pageUrl,
    item: pageInfo.item,
    siteLanguage: pageInfo.siteLanguage
  };

  showResultViewLoading();

  try {
    const review = await fetchReview(payload);
    showResultView(review, false);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    showResultView("Error: " + message, true);
  }

  document.getElementById("copy-btn")?.addEventListener("click", () => {
    const el = document.getElementById("result-content");
    const text = el?.textContent ?? "";
    if (text && el && !el.classList.contains("error")) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  });
  document.getElementById("close-result-btn")?.addEventListener("click", () => {
    showFormView();
    closePopup();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const starsRoot = document.getElementById("stars-root");
  const cancelBtn = document.getElementById("cancel-btn");
  const finishBtn = document.getElementById("finish-btn");

  if (!starsRoot) {
    console.error("Missing stars root element");
    return;
  }

  initStars(starsRoot);

  cancelBtn?.addEventListener("click", closePopup);
  finishBtn?.addEventListener("click", () => handleFinish(starsRoot));
});

