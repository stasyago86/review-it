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
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const fallback = { pageTitle: "", pageUrl: "", item: null };
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!(tab === null || tab === void 0 ? void 0 : tab.id) || ((_a = tab.url) === null || _a === void 0 ? void 0 : _a.startsWith("chrome://")) || ((_b = tab.url) === null || _b === void 0 ? void 0 : _b.startsWith("edge://"))) {
            return Object.assign(Object.assign({}, fallback), { pageTitle: (_c = tab === null || tab === void 0 ? void 0 : tab.title) !== null && _c !== void 0 ? _c : "", pageUrl: (_d = tab === null || tab === void 0 ? void 0 : tab.url) !== null && _d !== void 0 ? _d : "" });
        }
        const pageTitle = (_e = tab.title) !== null && _e !== void 0 ? _e : "";
        const pageUrl = (_f = tab.url) !== null && _f !== void 0 ? _f : "";
        let item = null;
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    var _a, _b, _c;
                    const h1 = document.querySelector("h1");
                    const ogTitle = document.querySelector('meta[property="og:title"]');
                    return ((_c = (_b = (_a = h1 === null || h1 === void 0 ? void 0 : h1.textContent) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : ogTitle === null || ogTitle === void 0 ? void 0 : ogTitle.getAttribute("content")) !== null && _c !== void 0 ? _c : null) || null;
                }
            });
            item = (_h = (_g = results === null || results === void 0 ? void 0 : results[0]) === null || _g === void 0 ? void 0 : _g.result) !== null && _h !== void 0 ? _h : null;
        }
        catch (_j) {
            // Page may not allow scripting (e.g. chrome://); ignore
        }
        return { pageTitle, pageUrl, item };
    }
    catch (_k) {
        return fallback;
    }
}
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const STORAGE_KEY = "openaiApiKey";
function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const key = result[STORAGE_KEY];
            resolve(typeof key === "string" && key.length > 0 ? key : null);
        });
    });
}
function buildReviewPrompt(payload) {
    const parts = [
        "You are a helpful assistant that writes short, natural product or service reviews.",
        "Based ONLY on the following information, write a single review between 100 and 200 words.",
        "Infer the type of subject from the URL and context (e.g. hotel, restaurant, car, service, product, or other).",
        "Match the tone and strength of the review to the star rating (1 = very negative, 5 = very positive).",
        "Do not invent details; base the review on the rating, page context, and any user comment below.",
        "",
        "Star rating (1–5): " + payload.rating,
        "Page title: " + (payload.pageTitle || "(none)"),
        "Page URL: " + (payload.pageUrl || "(none)"),
        payload.item ? "Item/name: " + payload.item : ""
    ];
    if (payload.text) {
        parts.push("", "User comment (include in the review): " + payload.text);
    }
    parts.push("", "Write only the review text, no headings or labels.");
    return parts.filter(Boolean).join("\n");
}
async function callOpenAI(apiKey, prompt) {
    var _a, _b, _c, _d, _e;
    const res = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 400
        })
    });
    if (!res.ok) {
        const errBody = await res.text();
        let msg = "OpenAI request failed: " + res.status;
        try {
            const j = JSON.parse(errBody);
            if ((_a = j.error) === null || _a === void 0 ? void 0 : _a.message)
                msg = j.error.message;
        }
        catch (_f) {
            if (errBody)
                msg += " " + errBody.slice(0, 200);
        }
        throw new Error(msg);
    }
    const data = await res.json();
    const content = (_e = (_d = (_c = (_b = data.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.trim();
    if (!content)
        throw new Error("No review text in response");
    return content;
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
    const resultContent = document.getElementById("result-content");
    if (formView)
        formView.classList.remove("hidden");
    if (resultView)
        resultView.classList.remove("visible");
    if (resultContent)
        resultContent.classList.remove("error", "loading");
}
async function handleFinish(starsRoot) {
    var _a, _b, _c, _d, _e;
    const textarea = document.getElementById("review-text");
    const text = (_a = textarea === null || textarea === void 0 ? void 0 : textarea.value.trim()) !== null && _a !== void 0 ? _a : "";
    const rating = getSelectedRating(starsRoot);
    const pageInfo = await getPageInfo();
    const payload = {
        rating,
        text,
        pageTitle: pageInfo.pageTitle,
        pageUrl: pageInfo.pageUrl,
        item: pageInfo.item
    };
    const apiKey = await getApiKey();
    if (!apiKey) {
        showResultView("Please set your OpenAI API key in the extension options (right-click the extension icon → Options).", true, true);
        (_b = document.getElementById("open-options-btn")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => {
            chrome.runtime.openOptionsPage();
        });
        (_c = document.getElementById("close-result-btn")) === null || _c === void 0 ? void 0 : _c.addEventListener("click", () => {
            showFormView();
            closePopup();
        });
        return;
    }
    showResultView("Generating review…", false);
    const resultContent = document.getElementById("result-content");
    if (resultContent)
        resultContent.classList.add("loading");
    try {
        const prompt = buildReviewPrompt(payload);
        const review = await callOpenAI(apiKey, prompt);
        if (resultContent)
            resultContent.classList.remove("loading");
        showResultView(review, false);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (resultContent)
            resultContent.classList.remove("loading");
        showResultView("Error: " + message, true);
    }
    (_d = document.getElementById("copy-btn")) === null || _d === void 0 ? void 0 : _d.addEventListener("click", () => {
        var _a;
        const el = document.getElementById("result-content");
        const text = (_a = el === null || el === void 0 ? void 0 : el.textContent) !== null && _a !== void 0 ? _a : "";
        if (text && el && !el.classList.contains("error")) {
            navigator.clipboard.writeText(text).catch(() => { });
        }
    });
    (_e = document.getElementById("close-result-btn")) === null || _e === void 0 ? void 0 : _e.addEventListener("click", () => {
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
