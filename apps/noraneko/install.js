// the "install" button on a drop's page.
// Inside noraneko, a built-in actor (webext-actors/drops-page) puts window.noranekoInstallDrop on this page;
// pressing the button opens about:nora:settings with the uuid, where the person reads the drop and then says yes.
// In any other browser the button offers the uuid to copy instead.
const inNoraneko = typeof window.noranekoInstallDrop === "function";
for (const el of document.querySelectorAll("[data-install]")) {
  const uuid = el.dataset.install;
  const hint = el.parentElement.querySelector(".status");
  if (inNoraneko) {
    el.addEventListener("click", () => {
      window.noranekoInstallDrop(uuid);
      hint.textContent = "opened noraneko's settings with this uuid. read it there, then press install.";
    });
  } else {
    el.textContent = "copy the uuid";
    el.addEventListener("click", async () => {
      await navigator.clipboard.writeText(uuid);
      hint.textContent = "copied. inside noraneko, paste it into about:nora:settings.";
    });
  }
}
