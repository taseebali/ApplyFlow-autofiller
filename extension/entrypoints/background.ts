export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel instead of a popup, so the
  // user never has to leave the tab they're filling out to see their profile.
  browser.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('Failed to set side panel behavior', err));

  // Phase 3 adds per-tab JD scrape caching and opener-tab tracking here.
});
