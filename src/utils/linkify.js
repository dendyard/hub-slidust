// Wrap bare URLs (not already inside an href) with clickable <a> tags
export const linkifyHtml = (html) =>
  html.replace(/(?<![="'`])(https?:\/\/[^\s<"]+)/g,
    url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );
