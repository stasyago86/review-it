"use strict";
/// <reference types="chrome" />
const MAX_STARS = 5;
const RATING_ATTR = "data-selected-rating";
let hoverRating = 0;
function getSelectedRating(container) {
    const val = container.getAttribute(RATING_ATTR);
    return val ? parseInt(val, 10) : 0;
}
function setSelectedRating(container, value) {
    container.setAttribute(RATING_ATTR, String(value));
}
function getEffectiveRating(container, index) {
    const current = hoverRating || getSelectedRating(container);
    return index <= current;
}
/** Update shine class on existing star nodes only (no DOM replace). */
function updateStarDisplay(container) {
    const stars = container.querySelectorAll(".star");
    stars.forEach((star, idx) => {
        const index = idx + 1;
        if (getEffectiveRating(container, index)) {
            star.classList.add("shine");
        }
        else {
            star.classList.remove("shine");
        }
    });
}
function initStars(container) {
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
async function getPageInfo() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const fallback = { pageTitle: "", pageUrl: "", item: null, siteLanguage: null };
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!(tab === null || tab === void 0 ? void 0 : tab.id) || ((_a = tab.url) === null || _a === void 0 ? void 0 : _a.startsWith("chrome://")) || ((_b = tab.url) === null || _b === void 0 ? void 0 : _b.startsWith("edge://"))) {
            return Object.assign(Object.assign({}, fallback), { pageTitle: (_c = tab === null || tab === void 0 ? void 0 : tab.title) !== null && _c !== void 0 ? _c : "", pageUrl: (_d = tab === null || tab === void 0 ? void 0 : tab.url) !== null && _d !== void 0 ? _d : "" });
        }
        const pageTitle = (_e = tab.title) !== null && _e !== void 0 ? _e : "";
        const pageUrl = (_f = tab.url) !== null && _f !== void 0 ? _f : "";
        let item = null;
        let siteLanguage = null;
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                    const h1 = document.querySelector("h1");
                    const ogTitle = document.querySelector('meta[property="og:title"]');
                    const langAttr = ((_b = (_a = document.documentElement) === null || _a === void 0 ? void 0 : _a.getAttribute("lang")) === null || _b === void 0 ? void 0 : _b.trim()) || "";
                    const metaLang = ((_d = (_c = document.querySelector('meta[http-equiv="content-language"]')) === null || _c === void 0 ? void 0 : _c.getAttribute("content")) === null || _d === void 0 ? void 0 : _d.trim()) ||
                        ((_f = (_e = document.querySelector('meta[name="language"]')) === null || _e === void 0 ? void 0 : _e.getAttribute("content")) === null || _f === void 0 ? void 0 : _f.trim()) ||
                        "";
                    const siteLanguage = (langAttr || metaLang || "").trim() || null;
                    const item = ((_j = (_h = (_g = h1 === null || h1 === void 0 ? void 0 : h1.textContent) === null || _g === void 0 ? void 0 : _g.trim()) !== null && _h !== void 0 ? _h : ogTitle === null || ogTitle === void 0 ? void 0 : ogTitle.getAttribute("content")) !== null && _j !== void 0 ? _j : null) || null;
                    return { item, siteLanguage };
                }
            });
            const r = (_g = results === null || results === void 0 ? void 0 : results[0]) === null || _g === void 0 ? void 0 : _g.result;
            item = (_h = r === null || r === void 0 ? void 0 : r.item) !== null && _h !== void 0 ? _h : null;
            siteLanguage = (_j = r === null || r === void 0 ? void 0 : r.siteLanguage) !== null && _j !== void 0 ? _j : null;
        }
        catch (_k) {
            // Page may not allow scripting (e.g. chrome://); ignore
        }
        return { pageTitle, pageUrl, item, siteLanguage };
    }
    catch (_l) {
        return fallback;
    }
}
const FETCH_REVIEW_TIMEOUT_MS = 15000;
async function fetchReview(payload) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_REVIEW_TIMEOUT_MS);
    try {
        const response = await fetch("https://review-it-backend-587398533610.europe-west4.run.app/api/review", {
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
    }
    catch (e) {
        const aborted = (e instanceof DOMException && e.name === "AbortError") ||
            (e instanceof Error && e.name === "AbortError");
        if (aborted) {
            throw new Error("Request timed out after 15 seconds. Check your connection and try again.");
        }
        throw e;
    }
    finally {
        window.clearTimeout(timeoutId);
    }
}
function setResultLoading(loading) {
    const loadingState = document.getElementById("loading-state");
    const resultBody = document.getElementById("result-body");
    if (loadingState)
        loadingState.classList.toggle("hidden", !loading);
    if (resultBody)
        resultBody.classList.toggle("hidden", loading);
}
function showResultViewLoading() {
    const formView = document.getElementById("form-view");
    const resultView = document.getElementById("result-view");
    if (formView)
        formView.classList.add("hidden");
    if (resultView)
        resultView.classList.add("visible");
    setResultLoading(true);
}
function showResultView(content, isError, showOptionsButton = false) {
    const formView = document.getElementById("form-view");
    const resultView = document.getElementById("result-view");
    const resultContent = document.getElementById("result-content");
    const copyBtn = document.getElementById("copy-btn");
    const openOptionsBtn = document.getElementById("open-options-btn");
    if (formView)
        formView.classList.add("hidden");
    if (resultView)
        resultView.classList.add("visible");
    setResultLoading(false);
    if (resultContent) {
        resultContent.textContent = content;
        resultContent.className = "result-text " + (isError ? "error" : "");
    }
    if (copyBtn)
        copyBtn.disabled = isError;
    if (openOptionsBtn)
        openOptionsBtn.style.display = showOptionsButton ? "inline-block" : "none";
}
function showFormView() {
    const formView = document.getElementById("form-view");
    const resultView = document.getElementById("result-view");
    const resultBody = document.getElementById("result-body");
    const resultContent = document.getElementById("result-content");
    if (formView)
        formView.classList.remove("hidden");
    if (resultView)
        resultView.classList.remove("visible");
    setResultLoading(false);
    if (resultBody)
        resultBody.classList.remove("hidden");
    if (resultContent)
        resultContent.classList.remove("error", "loading");
}
async function handleFinish(starsRoot) {
    var _a, _b, _c;
    const textarea = document.getElementById("review-text");
    const text = (_a = textarea === null || textarea === void 0 ? void 0 : textarea.value.trim()) !== null && _a !== void 0 ? _a : "";
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
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        showResultView("Error: " + message, true);
    }
    (_b = document.getElementById("copy-btn")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => {
        var _a;
        const el = document.getElementById("result-content");
        const text = (_a = el === null || el === void 0 ? void 0 : el.textContent) !== null && _a !== void 0 ? _a : "";
        if (text && el && !el.classList.contains("error")) {
            navigator.clipboard.writeText(text).catch(() => { });
        }
    });
    (_c = document.getElementById("close-result-btn")) === null || _c === void 0 ? void 0 : _c.addEventListener("click", () => {
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
    cancelBtn === null || cancelBtn === void 0 ? void 0 : cancelBtn.addEventListener("click", closePopup);
    finishBtn === null || finishBtn === void 0 ? void 0 : finishBtn.addEventListener("click", () => handleFinish(starsRoot));
});
