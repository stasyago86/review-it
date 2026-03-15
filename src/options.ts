/// <reference types="chrome" />

const API_KEY_STORAGE_KEY = "openaiApiKey";

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("api-key") as HTMLInputElement | null;
  const saveBtn = document.getElementById("save");
  const savedMsg = document.getElementById("saved-msg");

  if (!input || !saveBtn) return;

  chrome.storage.local.get([API_KEY_STORAGE_KEY], (result) => {
    const key = result[API_KEY_STORAGE_KEY];
    if (typeof key === "string") input.value = key;
  });

  saveBtn.addEventListener("click", () => {
    const value = input.value.trim();
    chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: value }, () => {
      if (savedMsg) {
        savedMsg.style.display = "block";
        setTimeout(() => { savedMsg.style.display = "none"; }, 2000);
      }
    });
  });
});
