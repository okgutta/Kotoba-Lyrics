// Fixed widths keep the placeholder stable while the lyrics request and DOM
// build are in progress. The staggered sweep makes the loading state legible
// without introducing a second spinner over the lyrics page.
const LINE_WIDTHS = [74, 58, 86, 49, 68, 81, 55, 72, 63, 84, 52, 77, 66, 88, 57, 70];

export const SkeletonMarkup = `
  <div class="sl-lyrics-skeleton">
    <div class="sl-lyrics-skeleton-lines" aria-hidden="true">
      ${LINE_WIDTHS.map(
        (width, index) =>
          `<div class="sl-lyrics-skeleton-line" style="width: ${width}%; --sl-skeleton-index: ${index}"></div>`
      ).join("")}
    </div>
    <div class="sl-lyrics-skeleton-status" role="status" aria-live="polite">
      <span>正在加载歌词</span><span class="sl-lyrics-skeleton-dots" aria-hidden="true"><i></i><i></i><i></i></span>
    </div>
  </div>`;
