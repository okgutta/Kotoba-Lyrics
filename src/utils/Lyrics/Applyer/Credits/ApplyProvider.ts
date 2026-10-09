export function ApplyLyricsProvider(data: any, LyricsContainer: HTMLElement): void {
  if (!data?.source || !LyricsContainer) return;

  const ProviderElement = document.createElement("div");
  ProviderElement.classList.add("LyricsProvider");

  const providerLabel = data.source === "lyriva" ? "LYRIVA" : "未知";
  ProviderElement.textContent = `歌词来源：${providerLabel}`;
  LyricsContainer.appendChild(ProviderElement);
}
