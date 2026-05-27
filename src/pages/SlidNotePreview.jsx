import { useEffect, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { linkifyHtml } from '../utils/linkify';
import goalLogo from '../assets/goallogo.png';
import styles from './SlidNotePreview.module.css';

const API_BASE = import.meta.env.VITE_API_BASE;

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('uploads/')) {
    const backendRoot = API_BASE.replace(/\/index\.php\/api\/?$/, '').replace(/\/api\/?$/, '');
    return `${backendRoot}/${url}`;
  }
  return url;
};

const parseYoutubeId = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const parts = u.pathname.split('/');
      const idx = parts.findIndex(p => p === 'embed' || p === 'shorts' || p === 'v');
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1].split('?')[0];
    }
  } catch {}
  return null;
};

const parseBlocks = (content) => {
  if (Array.isArray(content)) return content;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const BlockRenderer = ({ block }) => {
  if (block.type === 'paragraph') {
    return (
      <div
        className={styles.paragraph}
        dangerouslySetInnerHTML={{ __html: linkifyHtml(block.html || block.text || '') }}
        onClick={(e) => {
          if (e.target.tagName === 'A') {
            e.preventDefault();
            window.open(e.target.href, '_blank', 'noopener,noreferrer');
          }
        }}
      />
    );
  }

  if (block.type === 'image') {
    const ytId = parseYoutubeId(block.url);
    return (
      <div className={styles.mediaBlock}>
        {block.url ? (
          ytId ? (
            <img
              className={styles.mediaImg}
              src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
              alt={block.caption || ''}
            />
          ) : (
            <img
              className={styles.mediaImg}
              src={resolveMediaUrl(block.url)}
              alt={block.caption || ''}
            />
          )
        ) : null}
        {block.caption && <p className={styles.caption}>{block.caption}</p>}
      </div>
    );
  }

  if (block.type === 'video') {
    const ytId = parseYoutubeId(block.url);
    return (
      <div className={styles.mediaBlock}>
        {ytId ? (
          <iframe
            className={styles.videoEmbed}
            src={`https://www.youtube.com/embed/${ytId}`}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : block.url ? (
          <video className={styles.videoNative} src={resolveMediaUrl(block.url)} controls />
        ) : null}
        {block.caption && <p className={styles.caption}>{block.caption}</p>}
      </div>
    );
  }

  if (block.type === 'table') {
    // cells is a 2D array of HTML strings; colWidths/rowHeights are parallel arrays
    const cells = block.cells || [];
    const colWidths = block.colWidths || [];
    const rowHeights = block.rowHeights || [];
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          {colWidths.length > 0 && (
            <colgroup>
              {colWidths.map((w, ci) => <col key={ci} style={{ width: w }} />)}
            </colgroup>
          )}
          <tbody>
            {cells.map((row, ri) => (
              <tr key={ri} style={rowHeights[ri] ? { height: rowHeights[ri] } : {}}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={styles.tableCell}
                    dangerouslySetInnerHTML={{ __html: linkifyHtml(cell || '') }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'slider') {
    // images is a flat array of URL strings
    const images = Array.isArray(block.images) ? block.images.filter(Boolean) : [];
    const [active, setActive] = useState(0);
    const idx = Math.min(active, images.length - 1);
    return (
      <div className={styles.sliderBlock}>
        {images.length > 0 && (
          <div className={styles.sliderStage}>
            <img className={styles.sliderImg} src={resolveMediaUrl(images[idx])} alt="" />
            {images.length > 1 && (
              <div className={styles.sliderNav}>
                <button onClick={() => setActive(i => Math.max(0, i - 1))} disabled={idx === 0}>‹</button>
                <span>{idx + 1} / {images.length}</span>
                <button onClick={() => setActive(i => Math.min(images.length - 1, i + 1))} disabled={idx === images.length - 1}>›</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
};

const SlidNotePreview = ({ docId }) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); }
    catch { window.prompt('Copy link', url); }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1400);
  };
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/slid_note/public?id=${encodeURIComponent(docId)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { setDoc(data); setLoading(false); })
      .catch(err => { setError(err === 404 ? 'not_found' : 'error'); setLoading(false); });
  }, [docId]);

  if (loading) {
    return (
      <div className={styles.centered}>
        <p className={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  if (error === 'not_found') {
    return (
      <div className={styles.centered}>
        <p className={styles.errorTitle}>Document not found</p>
        <p className={styles.errorSub}>This document may be private or does not exist.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.centered}>
        <p className={styles.errorTitle}>Something went wrong</p>
      </div>
    );
  }

  const blocks = parseBlocks(doc.content);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.topBarInner}>
          <img src={goalLogo} alt="Slidust" className={styles.logo} />
          <div className={styles.topBarRight}>
            <div className={styles.authorMeta}>
              <span className={styles.authorName}>{doc.owner_name || 'Unknown'}</span>
              {doc.updated_at && (
                <span className={styles.lastUpdate}>Updated {formatDate(doc.updated_at)}</span>
              )}
            </div>
            <button
              className={`${styles.copyBtn} ${copiedLink ? styles.copyBtnSuccess : ''}`}
              onClick={handleCopyLink}
              title={copiedLink ? 'Copied!' : 'Copy link'}
            >
              {copiedLink ? <Check size={14} /> : <Link2 size={14} />}
              {copiedLink ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>{doc.title}</h1>
        </header>
        <main className={styles.body}>
          {blocks.map(block => (
            <BlockRenderer key={block.id} block={block} />
          ))}
        </main>
        <footer className={styles.footer}>
          <hr className={styles.divider} />
        </footer>
      </div>
    </div>
  );
};

export default SlidNotePreview;
