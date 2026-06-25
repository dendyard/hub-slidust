import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Film,
  Globe2,
  Highlighter,
  Image,
  Images,
  Italic,
  Link2,
  List,
  ListOrdered,
  Lock,
  Plus,
  Save,
  Search,
  Settings2,
  Share2,
  Strikethrough,
  Table,
  Trash2,
  Type,
  Underline,
  UserPlus,
  X,
} from 'lucide-react';
import { API_BASE, authFetch, resolveUploadUrl, useData } from '../../context/DataContext';
import UserAvatar from '../ui/UserAvatar';
import styles from './SlidNote.module.css';
import { linkifyHtml } from '../../utils/linkify';

const createId = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const nowIso = () => new Date().toISOString();

const formatDate = dateString => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const makeParagraphBlock = () => ({
  id: createId('block'),
  type: 'paragraph',
  html: '',
});

const makeMediaBlock = type => ({
  id: createId('block'),
  type,
  url: '',
  caption: '',
});

const makeSliderBlock = () => ({
  id: createId('block'),
  type: 'slider',
  images: ['', '', ''],
  activeIndex: 0,
});

const makeTableBlock = () => ({
  id: createId('block'),
  type: 'table',
  colWidths: [180, 180, 180],
  rowHeights: [44, 44, 44],
  cells: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => '')),
});

const makeBlock = type => {
  if (type === 'paragraph') return makeParagraphBlock();
  if (type === 'image' || type === 'video') return makeMediaBlock(type);
  if (type === 'slider') return makeSliderBlock();
  if (type === 'table') return makeTableBlock();
  return makeParagraphBlock();
};

const normalizeTable = block => {
  const rows = Math.max(block.cells?.length || 0, block.rowHeights?.length || 0, 1);
  const cols = Math.max(block.cells?.[0]?.length || 0, block.colWidths?.length || 0, 1);
  const colWidths = Array.from({ length: cols }, (_, index) => block.colWidths?.[index] || 180);
  const rowHeights = Array.from({ length: rows }, (_, index) => block.rowHeights?.[index] || 44);
  const cells = Array.from({ length: rows }, (_, rowIndex) => (
    Array.from({ length: cols }, (_, colIndex) => block.cells?.[rowIndex]?.[colIndex] || '')
  ));
  return { ...block, colWidths, rowHeights, cells };
};

const getBlockText = block => {
  if (block.type === 'paragraph') return htmlToText(block.html || block.text || '');
  if (block.type === 'table') return (block.cells || []).flat().map(htmlToText).join(' ');
  if (block.type === 'slider') return (block.images || []).join(' ');
  return `${block.url || ''} ${block.caption || ''}`;
};

const getThumbnail = blocks => {
  const list = Array.isArray(blocks) ? blocks : [];
  const imageBlock = list.find(block => block.type === 'image' && block.url);
  if (imageBlock) return { type: 'image', url: imageBlock.url };

  const sliderBlock = list.find(block => block.type === 'slider' && Array.isArray(block.images) && block.images.some(Boolean));
  if (sliderBlock) return { type: 'image', url: sliderBlock.images.find(Boolean) };

  const videoBlock = list.find(block => block.type === 'video' && block.url);
  if (videoBlock) {
    const ytId = parseYoutubeId(videoBlock.url);
    if (ytId) return { type: 'image', url: `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` };
  }

  return null;
};

const resolveMediaUrl = url => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('uploads/')) {
    const backendRoot = API_BASE.replace(/\/index\.php\/api\/?$/, '').replace(/\/api\/?$/, '');
    return `${backendRoot}/${url}`;
  }
  return resolveUploadUrl(url);
};

const htmlToText = html => {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.textContent?.replace(/\s+/g, ' ').trim() || '';
};

const parseYoutubeId = url => {
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

const blockOptions = [
  { type: 'paragraph', label: 'Text', icon: Type },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'video', label: 'Video', icon: Film },
  { type: 'table', label: 'Table', icon: Table },
  { type: 'slider', label: 'Image Slider', icon: Images },
];

const parseBlocks = content => {
  if (Array.isArray(content)) return content.length ? content : [makeParagraphBlock()];
  if (!content) return [makeParagraphBlock()];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) && parsed.length ? parsed : [makeParagraphBlock()];
  } catch {
    return [makeParagraphBlock()];
  }
};

const serializeBlocks = blocks => JSON.stringify(Array.isArray(blocks) ? blocks : [makeParagraphBlock()]);

const normalizeDocument = (doc, userId) => ({
  ...doc,
  visibility: doc?.visibility || 'public',
  editor_ids: Array.isArray(doc?.editor_ids) ? doc.editor_ids : [],
  owner_id: doc?.owner_id ?? userId ?? null,
  blocks: parseBlocks(doc?.blocks || doc?.content),
});

const sameId = (left, right) => String(left ?? '') === String(right ?? '');

const ImageLightbox = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      setScale(s => Math.min(Math.max(s * (e.deltaY < 0 ? 1.15 : 0.87), 0.2), 12));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = e => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { px: e.clientX - translate.x, py: e.clientY - translate.y };
    setDragging(true);
  };

  const onPointerMove = e => {
    if (!dragStart.current) return;
    setTranslate({ x: e.clientX - dragStart.current.px, y: e.clientY - dragStart.current.py });
  };

  const onPointerUp = () => { dragStart.current = null; setDragging(false); };

  const zoomIn = e => { e.stopPropagation(); setScale(s => Math.min(s * 1.35, 12)); };
  const zoomOut = e => { e.stopPropagation(); setScale(s => Math.max(s / 1.35, 0.2)); };
  const reset = e => { e.stopPropagation(); setScale(1); setTranslate({ x: 0, y: 0 }); };

  return createPortal(
    <div className={styles.lightboxOverlay} onClick={onClose}>
      <div
        ref={stageRef}
        className={styles.lightboxStage}
        onClick={e => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: dragging ? 'grabbing' : scale > 1 ? 'grab' : 'zoom-in' }}
      >
        <img
          src={src}
          alt=""
          className={styles.lightboxImage}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: dragging ? 'none' : 'transform 0.15s ease',
          }}
          draggable={false}
        />
      </div>
      <button className={styles.lightboxClose} onClick={e => { e.stopPropagation(); onClose(); }}>
        <X size={20} />
      </button>
      <div className={styles.lightboxZoomBar} onClick={e => e.stopPropagation()}>
        <button className={styles.lightboxZoomBtn} onClick={zoomOut} title="Zoom out">−</button>
        <span className={styles.lightboxZoomLabel} onClick={reset} title="Reset zoom">{Math.round(scale * 100)}%</span>
        <button className={styles.lightboxZoomBtn} onClick={zoomIn} title="Zoom in">+</button>
      </div>
    </div>,
    document.body,
  );
};

const SlidNoteAccessModal = ({ noteTitle, ownerUser, users, currentUser, initialEditorIds = [], onClose, onSave }) => {
  const [search, setSearch] = useState('');
  const [editorIds, setEditorIds] = useState(initialEditorIds);

  const candidateUsers = users
    .filter(user => !sameId(user.id, ownerUser?.id))
    .filter(user => {
      const keyword = search.trim().toLowerCase();
      if (!keyword) return true;
      return user.name?.toLowerCase().includes(keyword) || user.username?.toLowerCase().includes(keyword);
    });

  const toggleEditor = userId => {
    setEditorIds(prev => prev.some(id => sameId(id, userId)) ? prev.filter(id => !sameId(id, userId)) : [...prev, userId]);
  };

  return (
    <div className={styles.accessOverlay} onClick={onClose}>
      <div className={styles.accessModal} onClick={event => event.stopPropagation()}>
        <div className={styles.accessHeader}>
          <div className={styles.accessTitle}>
            <h3>Document Access</h3>
            <p>Choose who can edit "{noteTitle}". Owner always has edit access.</p>
          </div>
          <button className={styles.iconBtn} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.accessBody}>
          {ownerUser && (
            <div className={styles.accessRow}>
              <UserAvatar user={ownerUser} size={34} />
              <div className={styles.accessInfo}>
                <span className={styles.accessName}>{ownerUser.name} {sameId(ownerUser.id, currentUser?.id) ? '(You)' : ''}</span>
                <span className={styles.accessMeta}>Owner</span>
              </div>
              <button className={`${styles.accessToggle} ${styles.accessToggleActive}`} disabled>
                <Lock size={14} /> Owner
              </button>
            </div>
          )}

          <div className={styles.accessSearchWrap}>
            <Search size={14} />
            <input
              className={styles.accessSearch}
              placeholder="Search user..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          <div className={styles.accessList}>
            {candidateUsers.length === 0 ? (
              <div className={styles.accessEmpty}>No users found.</div>
            ) : candidateUsers.map(user => {
              const isEditor = editorIds.some(id => sameId(id, user.id));
              return (
                <div key={user.id} className={styles.accessRow}>
                  <UserAvatar user={user} size={34} />
                  <div className={styles.accessInfo}>
                    <span className={styles.accessName}>{user.name}</span>
                    <span className={styles.accessMeta}>@{user.username} · {user.role}</span>
                  </div>
                  <button
                    className={`${styles.accessToggle} ${isEditor ? styles.accessToggleActive : ''}`}
                    onClick={() => toggleEditor(user.id)}
                  >
                    <UserPlus size={14} /> {isEditor ? 'Can Edit' : 'Grant Edit'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.accessFooter}>
          <button className={styles.accessCancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.accessSaveBtn} onClick={() => onSave(editorIds)}>Save Access</button>
        </div>
      </div>
    </div>
  );
};

const EditableText = ({ className, value, placeholder, onChange, multiline = true, onFocus, readOnly = false }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value || '';
    }
  }, [value]);

  return (
    <div
      ref={ref}
      className={className}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      role="textbox"
      aria-multiline={multiline}
      onFocus={event => {
        if (readOnly) return;
        const element = event.currentTarget;
        onFocus?.(element, () => onChange(element.textContent || ''));
      }}
      onInput={event => !readOnly && onChange(event.currentTarget.textContent || '')}
      onKeyDown={event => {
        if (!multiline && event.key === 'Enter') event.preventDefault();
      }}
    />
  );
};

const RichText = ({ className, value, placeholder, onChange, onFocus, onCursorActive, readOnly = false }) => {
  const ref = useRef(null);

  useEffect(() => {
    const display = linkifyHtml(value || '');
    if (ref.current && ref.current.innerHTML !== display) {
      ref.current.innerHTML = display;
    }
  }, [value, readOnly]);

  return (
    <div
      ref={ref}
      className={className}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      role="textbox"
      aria-multiline="true"
      onMouseDown={() => !readOnly && onCursorActive?.()}
      onClick={event => {
        if (event.target.tagName === 'A') {
          event.preventDefault();
          window.open(event.target.href, '_blank', 'noopener,noreferrer');
        }
      }}
      onFocus={event => {
        if (readOnly) return;
        const element = event.currentTarget;
        onCursorActive?.();
        onFocus?.(element, () => onChange(element.innerHTML || ''));
      }}
      onInput={event => {
        if (readOnly) return;
        onCursorActive?.();
        onChange(event.currentTarget.innerHTML || '');
      }}
      onKeyDown={event => {
        if (readOnly) return;
        onCursorActive?.();
        if (event.key !== 'Tab') return;
        const selection = window.getSelection();
        const anchorNode = selection?.anchorNode;
        const anchorElement = anchorNode?.nodeType === Node.TEXT_NODE
          ? anchorNode.parentElement
          : anchorNode;
        if (!anchorElement?.closest?.('li')) return;

        event.preventDefault();
        document.execCommand(event.shiftKey ? 'outdent' : 'indent');
        onChange(event.currentTarget.innerHTML || '');
      }}
    />
  );
};

const fontSizes = Array.from({ length: 64 }, (_, index) => `${index + 9}px`);
const textColors = [
  '#111827', '#374151', '#6b7280', '#ef4444', '#f97316',
  '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6',
];
const backgroundColors = [
  { label: 'No color', value: 'transparent' },
  { label: 'Grey', value: '#e5e7eb' },
  { label: 'Yellow', value: '#fef3c7' },
  { label: 'Green', value: '#dcfce7' },
  { label: 'Blue', value: '#dbeafe' },
  { label: 'Purple', value: '#ede9fe' },
  { label: 'Red', value: '#fee2e2' },
];

const SlidNote = ({ activeNoteId, onOpenNote, onCloseNote }) => {
  const { currentUser, users, organizationMembers } = useData();
  const [documents, setDocuments] = useState([]);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [currentFontSize, setCurrentFontSize] = useState('');
  const [currentFormat, setCurrentFormat] = useState('p');
  const [openPalette, setOpenPalette] = useState(null);
  const [draggingImageBlockId, setDraggingImageBlockId] = useState(null);
  const [uploadingImageBlockId, setUploadingImageBlockId] = useState(null);
  const [draggingSliderSlot, setDraggingSliderSlot] = useState(null);
  const [uploadingSliderSlot, setUploadingSliderSlot] = useState(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  const resizeRef = useRef(null);
  const editorRef = useRef(null);
  const activeEditableRef = useRef(null);
  const savedSelectionRef = useRef(null);
  const documentsRef = useRef([]);
  const updateBlockRef = useRef(null);
  const saveTimers = useRef({});

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  useEffect(() => {
    const timers = saveTimers.current;
    const fetchDocuments = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (currentUser?.active_organization_id) {
          params.set('organization_id', currentUser.active_organization_id);
        }
        const qs = params.toString();
        const res = await authFetch(`${API_BASE}/slid_note${qs ? `?${qs}` : ''}`);
        const data = await res.json();
        const normalizedDocs = Array.isArray(data) ? data.map(doc => normalizeDocument(doc, currentUser?.id)) : [];
        documentsRef.current = normalizedDocs;
        setDocuments(normalizedDocs);
      } catch (err) {
        console.error('Failed to load Slid Note documents', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, [currentUser?.id, currentUser?.active_organization_id]);

  const saveDocumentToBackend = (id, payload, delay = 0) => {
    clearTimeout(saveTimers.current[id]);
    const save = async () => {
      try {
        const body = { id, ...payload };
        delete body.blocks;
        const res = await authFetch(`${API_BASE}/slid_note`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || `Save failed with ${res.status}`);
        }
        const saved = await res.json();
        if (saved?.id) {
          const normalized = normalizeDocument(saved, currentUser?.id);
          setDocuments(prev => {
            const next = prev.map(doc => sameId(doc.id, saved.id) ? normalized : doc);
            documentsRef.current = next;
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to save Slid Note document', err);
      }
    };

    if (delay <= 0) {
      save();
      return;
    }

    saveTimers.current[id] = setTimeout(save, delay);
  };

  function updateDocument(id, changes) {
    setDocuments(prev => {
      const next = prev.map(doc => (
        sameId(doc.id, id) ? { ...doc, ...changes, updated_at: nowIso() } : doc
      ));
      documentsRef.current = next;
      return next;
    });
  }

  function updateBlock(docId, blockId, updater, touch = true) {
    setDocuments(prev => {
      const next = prev.map(doc => {
        if (!sameId(doc.id, docId)) return doc;
        const blocks = (doc.blocks || []).map(block => {
          if (block.id !== blockId) return block;
          return typeof updater === 'function' ? updater(block) : { ...block, ...updater };
        });
        return { ...doc, blocks, updated_at: touch ? nowIso() : doc.updated_at };
      });
      documentsRef.current = next;
      return next;
    });
  }

  updateBlockRef.current = updateBlock;

  useEffect(() => {
    const handlePointerMove = event => {
      const resize = resizeRef.current;
      if (!resize) return;
      const delta = resize.axis === 'col'
        ? event.clientX - resize.start
        : event.clientY - resize.start;
      const nextSize = Math.max(resize.axis === 'col' ? 84 : 34, resize.initial + delta);
      updateBlockRef.current?.(resize.docId, resize.blockId, block => {
        const table = normalizeTable(block);
        if (resize.axis === 'col') {
          const colWidths = [...table.colWidths];
          colWidths[resize.index] = nextSize;
          return { ...table, colWidths };
        }
        const rowHeights = [...table.rowHeights];
        rowHeights[resize.index] = nextSize;
        return { ...table, rowHeights };
      }, false);
    };
    const handlePointerUp = () => {
      resizeRef.current = null;
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return documents
      .filter(doc => {
        if (!normalized) return true;
        const haystack = `${doc.title || ''} ${(doc.blocks || []).map(getBlockText).join(' ')}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }, [documents, query]);

  const activeDocument = documents.find(doc => sameId(doc.id, activeNoteId)) || null;
  const activeOrgId = currentUser?.active_organization_id ?? null;
  const orgUserIds = activeOrgId
    ? new Set(organizationMembers.filter(member => sameId(member.organization_id, activeOrgId)).map(member => String(member.user_id)))
    : null;
  const orgUsers = orgUserIds ? users.filter(user => orgUserIds.has(String(user.id))) : users;
  const canManageNotes = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const ownerUser = activeDocument ? (users.find(user => sameId(user.id, activeDocument.owner_id)) || null) : null;
  const editorUsers = (Array.isArray(activeDocument?.editor_ids) ? activeDocument.editor_ids : [])
    .map(id => users.find(user => sameId(user.id, id)))
    .filter(Boolean);
  const isOwner = sameId(activeDocument?.owner_id, currentUser?.id);
  const canEdit = isOwner || (Array.isArray(activeDocument?.editor_ids) && activeDocument.editor_ids.some(id => sameId(id, currentUser?.id)));

  useEffect(() => {
    if (!activeDocument) return undefined;

    const hideBlockControls = event => {
      if (editorRef.current?.contains(event.target)) return;
      setActiveBlockId(null);
      setOpenPalette(null);
    };

    document.addEventListener('pointerdown', hideBlockControls);
    return () => document.removeEventListener('pointerdown', hideBlockControls);
  }, [activeDocument]);

  const registerEditable = (element, save, blockId = null) => {
    setOpenPalette(null);
    activeEditableRef.current = { element, save, blockId };
  };

  const saveSelection = () => {
    const active = activeEditableRef.current;
    const selection = window.getSelection();
    if (!active?.element || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer.nodeType === window.Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer;

    if (container && active.element.contains(container)) {
      savedSelectionRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const active = activeEditableRef.current;
    const range = savedSelectionRef.current;
    if (!active?.element || !range) return false;

    active.element.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  };

  const getSelectionElement = () => {
    const active = activeEditableRef.current;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : savedSelectionRef.current;
    if (!active?.element || !range) return null;

    const node = range.startContainer.nodeType === window.Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer;

    return node && active.element.contains(node) ? node : null;
  };

  const refreshToolbarState = () => {
    const node = getSelectionElement();
    if (!node) return;

    const block = node.closest?.('h1,h2,h3,blockquote,p,li,div');
    const tag = block?.tagName?.toLowerCase();
    setCurrentFormat(['h1', 'h2', 'h3', 'blockquote'].includes(tag) ? tag : 'p');

    const styledNode = node.closest?.('[style*="font-size"]') || node;
    const rawSize = window.getComputedStyle(styledNode).fontSize;
    const roundedSize = `${Math.round(Number.parseFloat(rawSize))}px`;
    setCurrentFontSize(fontSizes.includes(roundedSize) ? roundedSize : '');
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      saveSelection();
      refreshToolbarState();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  });

  const handleSaveNow = () => {
    if (!activeDocument) return;
    if (!canEdit) return;

    flushSync(() => {
      activeEditableRef.current?.save?.();
    });

    const latestDocument = documentsRef.current.find(doc => sameId(doc.id, activeDocument.id)) || activeDocument;
    const activeEditable = activeEditableRef.current;
    const latestBlocks = (latestDocument.blocks || []).map(block => {
      if (!activeEditable?.element || !sameId(block.id, activeEditable.blockId)) return block;
      return { ...block, html: activeEditable.element.innerHTML || '' };
    });
    const documentToSave = { ...latestDocument, blocks: latestBlocks };
    updateDocument(documentToSave.id, {
      blocks: documentToSave.blocks,
      title: documentToSave.title,
      visibility: documentToSave.visibility || 'public',
      editor_ids: documentToSave.editor_ids || [],
    });
    clearTimeout(saveTimers.current[latestDocument.id]);
    const payload = {
      title: documentToSave.title,
      content: serializeBlocks(documentToSave.blocks),
      visibility: documentToSave.visibility || 'public',
      editor_ids: documentToSave.editor_ids || [],
    };
    saveDocumentToBackend(documentToSave.id, payload, 0);
    setSavedPulse(true);
    setTimeout(() => setSavedPulse(false), 1400);
  };

  const applyCommand = (command, value = null) => {
    const active = activeEditableRef.current;
    if (!active?.element) return;
    restoreSelection();
    active.element.focus();
    document.execCommand(command, false, value);
    saveSelection();
    refreshToolbarState();
    active.save?.();
  };

  const applyBlockFormat = format => {
    applyCommand('formatBlock', format);
    setCurrentFormat(format);
  };

  const applyFontSize = size => {
    const active = activeEditableRef.current;
    if (!active?.element) return;

    restoreSelection();
    active.element.focus();

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range && active.element.contains(range.commonAncestorContainer) && !range.collapsed) {
      const span = document.createElement('span');
      span.style.fontSize = size;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      selection.removeAllRanges();
      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      selection.addRange(nextRange);
    } else {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('fontSize', false, '7');
      active.element.querySelectorAll('font[size="7"]').forEach(font => {
        font.removeAttribute('size');
        font.style.fontSize = size;
      });
    }

    saveSelection();
    setCurrentFontSize(size);
    active.save?.();
  };

  const clearBackgroundColor = (element, range) => {
    const cleanup = node => {
      if (!node?.style) return;
      node.style.backgroundColor = '';
      node.style.removeProperty('background-color');
      node.style.removeProperty('background');
      if (!node.getAttribute('style')) node.removeAttribute('style');
    };

    const collectStyledAncestors = node => {
      const start = node?.nodeType === window.Node.TEXT_NODE ? node.parentElement : node;
      let current = start;
      while (current && current !== element) {
        if (current.getAttribute?.('style')?.toLowerCase().includes('background')) cleanup(current);
        current = current.parentElement;
      }
    };

    if (!range || range.collapsed) {
      collectStyledAncestors(range?.startContainer || getSelectionElement());
      return;
    }

    collectStyledAncestors(range.startContainer);
    collectStyledAncestors(range.endContainer);

    const walker = document.createTreeWalker(element, window.NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      if (range.intersectsNode(walker.currentNode)) cleanup(walker.currentNode);
    }
  };

  const handlePaletteToggle = (event, palette) => {
    event.stopPropagation();
    saveSelection();
    setOpenPalette(open => open === palette ? null : palette);
  };

  const applyInlineStyle = (styleName, value) => {
    const active = activeEditableRef.current;
    if (!active?.element) return;

    restoreSelection();
    active.element.focus();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

    if (value === 'transparent' && styleName === 'backgroundColor') {
      clearBackgroundColor(active.element, range);
      saveSelection();
      active.save?.();
      setOpenPalette(null);
      return;
    }

    if (range && active.element.contains(range.commonAncestorContainer) && !range.collapsed) {
      const span = document.createElement('span');
      span.style[styleName] = value;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      selection.removeAllRanges();
      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      selection.addRange(nextRange);
    } else if (styleName === 'color') {
      document.execCommand('foreColor', false, value);
    } else {
      document.execCommand('hiliteColor', false, value);
    }

    saveSelection();
    active.save?.();
    setOpenPalette(null);
  };

  const handleCreate = async () => {
    const id = createId('sn');
    const now = nowIso();
    const doc = {
      id,
      title: 'Untitled Slid Note',
      owner_id: currentUser?.id ?? null,
      organization_id: currentUser?.active_organization_id ?? null,
      visibility: 'public',
      editor_ids: [],
      blocks: [makeParagraphBlock()],
      created_at: now,
      updated_at: now,
    };
    setDocuments(prev => {
      const next = [doc, ...prev];
      documentsRef.current = next;
      return next;
    });
    onOpenNote(id);

    try {
      const res = await authFetch(`${API_BASE}/slid_note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: doc.title,
          content: serializeBlocks(doc.blocks),
          organization_id: doc.organization_id,
          visibility: doc.visibility,
          editor_ids: doc.editor_ids,
        }),
      });
      const saved = await res.json();
      if (saved?.id) {
        const normalized = normalizeDocument(saved, currentUser?.id);
        setDocuments(prev => {
          const next = prev.map(item => sameId(item.id, id) ? normalized : item);
          documentsRef.current = next;
          return next;
        });
        onOpenNote(saved.id);
      }
    } catch (err) {
      console.error('Failed to create Slid Note document', err);
    }
  };

  const deleteDocument = async id => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
    if (sameId(id, activeNoteId)) onCloseNote();
    try {
      await authFetch(`${API_BASE}/slid_note?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete Slid Note document', err);
    }
  };

  const addBlock = type => {
    if (!activeDocument || !canEdit) return;
    updateDocument(activeDocument.id, {
      blocks: [...(activeDocument.blocks || []), makeBlock(type)],
    });
  };

  const deleteBlock = blockId => {
    if (!activeDocument || !canEdit) return;
    const remaining = (activeDocument.blocks || []).filter(block => block.id !== blockId);
    updateDocument(activeDocument.id, {
      blocks: remaining.length ? remaining : [makeParagraphBlock()],
    });
  };

  const moveBlock = (blockId, direction) => {
    if (!activeDocument || !canEdit) return;
    const blocks = [...(activeDocument.blocks || [])];
    const index = blocks.findIndex(block => block.id === blockId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= blocks.length) return;
    [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
    updateDocument(activeDocument.id, { blocks });
  };

  const copyLink = async () => {
    if (!activeDocument) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.pathname = `/slidnote/${activeDocument.id}`;
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      window.prompt('Copy link', url.toString());
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const copyShareLink = async () => {
    if (!activeDocument) return;
    // Clean frontend URL, e.g. https://slidust.xyz/slidnote/preview/{id}.
    const url = new URL(window.location.href);
    url.search = '';
    url.pathname = `/slidnote/preview/${activeDocument.id}`;
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      window.prompt('Copy public link', url.toString());
    }
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 1400);
  };

  const toggleVisibility = () => {
    if (!activeDocument || !canEdit) return;
    const nextVisibility = activeDocument.visibility === 'private' ? 'public' : 'private';
    updateDocument(activeDocument.id, { visibility: nextVisibility });
    saveDocumentToBackend(activeDocument.id, {
      title: activeDocument.title,
      content: serializeBlocks(activeDocument.blocks),
      visibility: nextVisibility,
      editor_ids: activeDocument.editor_ids || [],
    }, 0);
  };

  const saveEditorAccess = editorIds => {
    if (!activeDocument || !isOwner) return;
    updateDocument(activeDocument.id, { editor_ids: editorIds });
    saveDocumentToBackend(activeDocument.id, {
      title: activeDocument.title,
      content: serializeBlocks(activeDocument.blocks),
      visibility: activeDocument.visibility || 'public',
      editor_ids: editorIds,
    }, 0);
    setShowAccessModal(false);
  };

  const addTableRow = block => {
    if (!canEdit) return;
    updateBlock(activeDocument.id, block.id, current => {
      const table = normalizeTable(current);
      return {
        ...table,
        rowHeights: [...table.rowHeights, 44],
        cells: [...table.cells, Array.from({ length: table.colWidths.length }, () => '')],
      };
    });
  };

  const addTableColumn = block => {
    if (!canEdit) return;
    updateBlock(activeDocument.id, block.id, current => {
      const table = normalizeTable(current);
      return {
        ...table,
        colWidths: [...table.colWidths, 180],
        cells: table.cells.map(row => [...row, '']),
      };
    });
  };

  const deleteTableRow = block => {
    if (!canEdit) return;
    updateBlock(activeDocument.id, block.id, current => {
      const table = normalizeTable(current);
      if (table.cells.length <= 1) return table;
      return {
        ...table,
        rowHeights: table.rowHeights.slice(0, -1),
        cells: table.cells.slice(0, -1),
      };
    });
  };

  const deleteTableColumn = block => {
    if (!canEdit) return;
    updateBlock(activeDocument.id, block.id, current => {
      const table = normalizeTable(current);
      if (table.colWidths.length <= 1) return table;
      return {
        ...table,
        colWidths: table.colWidths.slice(0, -1),
        cells: table.cells.map(row => row.slice(0, -1)),
      };
    });
  };

  const uploadImageToBlock = async (block, file) => {
    if (!canEdit || !activeDocument || !file) return;
    if (!file.type?.startsWith('image/')) {
      console.error('Selected file is not an image');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_id', activeDocument.id);
    setUploadingImageBlockId(block.id);

    try {
      const res = await authFetch(`${API_BASE}/slid_note/assets`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `Upload failed with ${res.status}`);
      }
      const url = data.file_path || data.url || '';
      if (!url) throw new Error('Upload response tidak berisi file_path.');
      updateBlock(activeDocument.id, block.id, { url });
    } catch (err) {
      console.error('Failed to upload Slid Note image', err);
    } finally {
      setUploadingImageBlockId(null);
      setDraggingImageBlockId(null);
    }
  };

  const uploadSliderImage = async (block, file, slideIndex) => {
    if (!canEdit || !activeDocument || !file) return;
    if (!file.type?.startsWith('image/')) return;

    const slotKey = `${block.id}_${slideIndex}`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_id', activeDocument.id);
    setUploadingSliderSlot(slotKey);

    try {
      const res = await authFetch(`${API_BASE}/slid_note/assets`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.message || `Upload failed with ${res.status}`);
      const url = data.file_path || data.url || '';
      if (!url) throw new Error('Upload response tidak berisi file_path.');
      updateBlock(activeDocument.id, block.id, current => {
        const nextImages = [...(current.images || [])];
        nextImages[slideIndex] = url;
        return { ...current, images: nextImages };
      });
    } catch (err) {
      console.error('Failed to upload slider image', err);
    } finally {
      setUploadingSliderSlot(null);
      setDraggingSliderSlot(null);
    }
  };

  const updateTableCell = (block, rowIndex, colIndex, value) => {
    if (!canEdit) return;
    updateBlock(activeDocument.id, block.id, current => {
      const table = normalizeTable(current);
      const cells = table.cells.map(row => [...row]);
      cells[rowIndex][colIndex] = value;
      return { ...table, cells };
    });
  };

  const startResize = (event, block, axis, index, initial) => {
    if (!canEdit) return;
    event.preventDefault();
    resizeRef.current = {
      docId: activeDocument.id,
      blockId: block.id,
      axis,
      index,
      start: axis === 'col' ? event.clientX : event.clientY,
      initial,
    };
  };

  const writingToolbar = (
    <div
      className={styles.writingToolbar}
      onMouseDown={event => {
        saveSelection();
        const interactiveControl = event.target.closest?.('select, input, .paletteMenu, .palettePopup');
        if (!interactiveControl) event.preventDefault();
      }}
    >
      <select
        className={styles.formatSelect}
        value={currentFormat}
        onChange={event => {
          applyBlockFormat(event.target.value);
        }}
        title="Text style"
      >
        <option value="p">Normal</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="blockquote">Quote</option>
      </select>
      <select
        className={styles.formatSelect}
        value={currentFontSize}
        onChange={event => {
          applyFontSize(event.target.value);
        }}
        title="Font size"
      >
        <option value="">Size</option>
        {fontSizes.map(size => <option key={size} value={size}>{size}</option>)}
      </select>
      <button onClick={() => applyCommand('bold')} title="Bold"><Bold size={15} /></button>
      <button onClick={() => applyCommand('italic')} title="Italic"><Italic size={15} /></button>
      <button onClick={() => applyCommand('underline')} title="Underline"><Underline size={15} /></button>
      <button onClick={() => applyCommand('strikeThrough')} title="Strike"><Strikethrough size={15} /></button>
      <button onClick={() => applyCommand('justifyLeft')} title="Align left"><AlignLeft size={15} /></button>
      <button onClick={() => applyCommand('justifyCenter')} title="Align center"><AlignCenter size={15} /></button>
      <button onClick={() => applyCommand('justifyRight')} title="Align right"><AlignRight size={15} /></button>
      <button onClick={() => applyCommand('insertUnorderedList')} title="Bullets"><List size={15} /></button>
      <button onClick={() => applyCommand('insertOrderedList')} title="Numbered list"><ListOrdered size={15} /></button>
      <div className={styles.paletteMenu} title="Text color">
        <button
          type="button"
          className={styles.paletteButton}
          onClick={event => handlePaletteToggle(event, 'text')}
          title="Text color palette"
        >
          <Type size={15} />
          <ChevronDown size={11} />
        </button>
        <div className={`${styles.palettePopup} ${openPalette === 'text' ? styles.palettePopupOpen : ''}`}>
          {textColors.map(color => (
            <button
              key={color}
              className={styles.paletteSwatch}
              style={{ '--swatch-color': color }}
              onMouseDown={event => {
                event.preventDefault();
                applyInlineStyle('color', color);
              }}
              title={color}
            />
          ))}
        </div>
      </div>
      <div className={styles.paletteMenu} title="Background color">
        <button
          type="button"
          className={styles.paletteButton}
          onClick={event => handlePaletteToggle(event, 'bg')}
          title="Background color palette"
        >
          <Highlighter size={15} />
          <ChevronDown size={11} />
        </button>
        <div className={`${styles.palettePopup} ${openPalette === 'bg' ? styles.palettePopupOpen : ''}`}>
          {backgroundColors.map(color => (
            <button
              key={color.value}
              className={`${styles.paletteSwatch} ${color.value === 'transparent' ? styles.paletteTransparent : ''}`}
              style={{ '--swatch-color': color.value }}
              onMouseDown={event => {
                event.preventDefault();
                applyInlineStyle('backgroundColor', color.value);
              }}
              title={color.label}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const renderBlock = (block, index) => {
    if (!activeDocument) return null;

    if (block.type === 'paragraph') {
      return (
        <RichText
          className={styles.paragraphInput}
          value={block.html || block.text || ''}
          placeholder={index === 0 ? 'Start writing freely...' : 'Write something...'}
          onChange={value => updateBlock(activeDocument.id, block.id, { html: value })}
          onFocus={(element, save) => registerEditable(element, save, block.id)}
          onCursorActive={() => setOpenPalette(null)}
          readOnly={!canEdit}
        />
      );
    }

    if (block.type === 'image') {
      const isDragging = sameId(draggingImageBlockId, block.id);
      const isUploading = sameId(uploadingImageBlockId, block.id);
      return (
        <div className={styles.mediaBlock}>
          <div
            className={`${styles.imageDropZone} ${isDragging ? styles.imageDropZoneActive : ''} ${isUploading ? styles.imageDropZoneUploading : ''}`}
            onDragEnter={event => {
              if (!canEdit) return;
              event.preventDefault();
              setDraggingImageBlockId(block.id);
            }}
            onDragOver={event => {
              if (!canEdit) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
              setDraggingImageBlockId(block.id);
            }}
            onDragLeave={event => {
              if (!canEdit || event.currentTarget.contains(event.relatedTarget)) return;
              setDraggingImageBlockId(null);
            }}
            onDrop={event => {
              if (!canEdit) return;
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              uploadImageToBlock(block, file);
            }}
          >
            {block.url ? (
              <img
                className={styles.imagePreview}
                src={resolveMediaUrl(block.url)}
                alt=""
                onClick={() => setPreviewSrc(resolveMediaUrl(block.url))}
              />
            ) : (
              <div className={styles.emptyMedia}>
                <Image size={24} />
                <span>{isUploading ? 'Uploading image...' : 'Drop image here or click to upload'}</span>
              </div>
            )}
            {block.url && (isDragging || isUploading) && (
              <span className={styles.imageDropOverlay}>{isUploading ? 'Uploading image...' : 'Drop to replace image'}</span>
            )}
            {canEdit && !block.url && (
              <input
                type="file"
                accept="image/*"
                className={styles.hiddenFileInput}
                disabled={isUploading}
                onChange={event => {
                  const file = event.target.files?.[0];
                  uploadImageToBlock(block, file);
                  event.target.value = '';
                }}
              />
            )}
          </div>
          <EditableText
            className={styles.caption}
            value={block.caption || ''}
            placeholder="Caption"
            onChange={value => updateBlock(activeDocument.id, block.id, { caption: value })}
            multiline={false}
            readOnly={!canEdit}
          />
        </div>
      );
    }

    if (block.type === 'video') {
      const ytId = parseYoutubeId(block.url);
      return (
        <div className={styles.mediaBlock}>
          {canEdit && (
            <input
              className={styles.urlInput}
              value={block.url || ''}
              onChange={event => updateBlock(activeDocument.id, block.id, { url: event.target.value })}
              placeholder="YouTube URL (e.g. https://youtu.be/...)"
            />
          )}
          {ytId ? (
            <iframe
              className={styles.videoPreview}
              src={`https://www.youtube.com/embed/${ytId}?rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
            />
          ) : (
            <div className={styles.emptyMedia}>
              <Film size={24} />
              <span>{block.url ? 'Invalid YouTube URL' : 'Paste a YouTube URL above'}</span>
            </div>
          )}
        </div>
      );
    }

    if (block.type === 'slider') {
      const images = Array.isArray(block.images) && block.images.length ? block.images : [''];
      const activeIndex = Math.min(block.activeIndex || 0, images.length - 1);
      const activeUrl = images[activeIndex] ? resolveMediaUrl(images[activeIndex]) : '';
      const slotKey = idx => `${block.id}_${idx}`;
      const isUploadingSlot = idx => uploadingSliderSlot === slotKey(idx);
      const isDraggingSlot = idx => draggingSliderSlot === slotKey(idx);

      const setImages = nextImages => updateBlock(activeDocument.id, block.id, {
        images: nextImages,
        activeIndex: Math.min(activeIndex, nextImages.length - 1),
      });

      const removeSlide = idx => {
        const next = images.filter((_, i) => i !== idx);
        setImages(next.length ? next : ['']);
      };

      return (
        <div className={styles.sliderBlock}>
          {/* Stage */}
          <div
            className={`${styles.sliderStage} ${isDraggingSlot(activeIndex) ? styles.imageDropZoneActive : ''} ${isUploadingSlot(activeIndex) ? styles.imageDropZoneUploading : ''}`}
            onDragEnter={e => { if (!canEdit) return; e.preventDefault(); setDraggingSliderSlot(slotKey(activeIndex)); }}
            onDragOver={e => { if (!canEdit) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDraggingSliderSlot(slotKey(activeIndex)); }}
            onDragLeave={e => { if (!canEdit || e.currentTarget.contains(e.relatedTarget)) return; setDraggingSliderSlot(null); }}
            onDrop={e => { if (!canEdit) return; e.preventDefault(); uploadSliderImage(block, e.dataTransfer.files?.[0], activeIndex); }}
          >
            {activeUrl ? (
              <img
                src={activeUrl}
                alt=""
                onClick={() => setPreviewSrc(activeUrl)}
              />
            ) : (
              <div className={styles.emptyMedia}>
                <Images size={24} />
                <span>{isUploadingSlot(activeIndex) ? 'Uploading image...' : 'Drop image here or click to upload'}</span>
              </div>
            )}
            {activeUrl && (isDraggingSlot(activeIndex) || isUploadingSlot(activeIndex)) && (
              <span className={styles.imageDropOverlay}>
                {isUploadingSlot(activeIndex) ? 'Uploading image...' : 'Drop to replace image'}
              </span>
            )}
            {canEdit && !activeUrl && (
              <input
                type="file"
                accept="image/*"
                className={styles.hiddenFileInput}
                disabled={isUploadingSlot(activeIndex)}
                onChange={e => { uploadSliderImage(block, e.target.files?.[0], activeIndex); e.target.value = ''; }}
              />
            )}
            {images.length > 1 && (
              <>
                <button
                  className={`${styles.sliderNav} ${styles.sliderPrev}`}
                  onClick={() => updateBlock(activeDocument.id, block.id, { activeIndex: activeIndex === 0 ? images.length - 1 : activeIndex - 1 })}
                  title="Previous image"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className={`${styles.sliderNav} ${styles.sliderNext}`}
                  onClick={() => updateBlock(activeDocument.id, block.id, { activeIndex: activeIndex === images.length - 1 ? 0 : activeIndex + 1 })}
                  title="Next image"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            {images.length > 1 && (
              <span className={styles.sliderCounter}>{activeIndex + 1} / {images.length}</span>
            )}
          </div>

          {/* Thumbnail strip */}
          <div className={styles.sliderThumbs}>
            {images.map((url, idx) => {
              const thumbUrl = url ? resolveMediaUrl(url) : '';
              return (
                <div
                  key={idx}
                  className={`${styles.sliderThumb} ${idx === activeIndex ? styles.sliderThumbActive : ''} ${isDraggingSlot(idx) ? styles.sliderThumbDragging : ''}`}
                  onClick={() => updateBlock(activeDocument.id, block.id, { activeIndex: idx })}
                  onDragEnter={e => { if (!canEdit) return; e.preventDefault(); setDraggingSliderSlot(slotKey(idx)); }}
                  onDragOver={e => { if (!canEdit) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDraggingSliderSlot(slotKey(idx)); }}
                  onDragLeave={e => { if (!canEdit || e.currentTarget.contains(e.relatedTarget)) return; setDraggingSliderSlot(null); }}
                  onDrop={e => { if (!canEdit) return; e.preventDefault(); uploadSliderImage(block, e.dataTransfer.files?.[0], idx); }}
                >
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" className={styles.sliderThumbImg} />
                  ) : (
                    <div className={styles.sliderThumbEmpty}>
                      {isUploadingSlot(idx) ? '…' : <Images size={14} />}
                    </div>
                  )}
                  {canEdit && !thumbUrl && (
                    <input
                      type="file"
                      accept="image/*"
                      className={styles.hiddenFileInput}
                      disabled={isUploadingSlot(idx)}
                      onChange={e => { uploadSliderImage(block, e.target.files?.[0], idx); e.target.value = ''; }}
                    />
                  )}
                  {canEdit && images.length > 1 && (
                    <button
                      className={styles.sliderThumbDelete}
                      onClick={e => { e.stopPropagation(); removeSlide(idx); }}
                      title="Remove slide"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              );
            })}
            {canEdit && (
              <button className={styles.sliderThumbAdd} onClick={() => setImages([...images, ''])} title="Add slide">
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>
      );
    }

    if (block.type === 'table') {
      const table = normalizeTable(block);
      return (
        <div className={styles.tableBlock}>
          {canEdit && (
            <div className={styles.tableActions}>
              <button onClick={() => addTableRow(block)} title="Add row"><span>+</span> Row</button>
              <button onClick={() => addTableColumn(block)} title="Add column"><span>+</span> Column</button>
              <button onClick={() => deleteTableRow(block)} title="Delete last row"><span>-</span> Row</button>
              <button onClick={() => deleteTableColumn(block)} title="Delete last column"><span>-</span> Column</button>
            </div>
          )}
          <div className={styles.tableScroll}>
            <table className={styles.noteTable}>
              <colgroup>
                {table.colWidths.map((width, colIndex) => (
                  <col key={colIndex} style={{ width }} />
                ))}
              </colgroup>
              <tbody>
                {table.cells.map((row, rowIndex) => (
                  <tr key={rowIndex} style={{ height: table.rowHeights[rowIndex] }}>
                    {row.map((cell, colIndex) => (
                      <td key={`${rowIndex}_${colIndex}`}>
                        <RichText
                          className={styles.cellInput}
                          value={cell}
                          placeholder=""
                          onChange={value => updateTableCell(table, rowIndex, colIndex, value)}
                          onFocus={registerEditable}
                          onCursorActive={() => setOpenPalette(null)}
                          readOnly={!canEdit}
                        />
                        {canEdit && rowIndex === 0 && (
                          <span
                            className={styles.colResizeHandle}
                            onPointerDown={event => startResize(event, table, 'col', colIndex, table.colWidths[colIndex])}
                          />
                        )}
                        {canEdit && colIndex === 0 && (
                          <span
                            className={styles.rowResizeHandle}
                            onPointerDown={event => startResize(event, table, 'row', rowIndex, table.rowHeights[rowIndex])}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return null;
  };

  if (activeDocument) {
    return (
      <div className={styles.editorPage}>
        <header className={styles.topbar}>
          <div className={`${styles.topbarSide} ${styles.topbarLeft}`}>
            <button className={styles.iconBtn} onClick={onCloseNote} title="Back">
              <ArrowLeft size={16} />
            </button>

            <button
              className={styles.visibilityBtn}
              onClick={toggleVisibility}
              disabled={!canEdit}
              title={canEdit ? 'Toggle note visibility' : 'Note visibility'}
            >
              {activeDocument.visibility === 'private' ? <Lock size={14} /> : <Globe2 size={14} />}
              {activeDocument.visibility === 'private' ? 'Private' : 'Public'}
            </button>
          </div>

          <div className={styles.fileTitle}>
            <div className={styles.fileTitleGroup}>
              {(ownerUser || editorUsers.length > 0) && (
                <div className={styles.fileAvatarStack}>
                  {ownerUser && <UserAvatar className={styles.fileAvatar} user={ownerUser} size={26} title={ownerUser.name} />}
                  {editorUsers.map(user => (
                    <UserAvatar key={user.id} className={styles.fileAvatar} user={user} size={26} title={user.name} />
                  ))}
                </div>
              )}
              <input
                className={styles.titleInput}
                value={activeDocument.title}
                onChange={canEdit ? (event => updateDocument(activeDocument.id, { title: event.target.value })) : undefined}
                readOnly={!canEdit}
                placeholder="Slid Note title"
              />
            </div>
          </div>

          <div className={`${styles.topbarSide} ${styles.topbarRight}`}>
            {canEdit ? (
              <>
                <span className={styles.savedText}><Clock size={12} /> {savedPulse ? 'Saved' : formatDate(activeDocument.updated_at)}</span>
                <button className={styles.saveBtn} onClick={handleSaveNow}>
                  <Save size={14} /> Save
                </button>
                <button className={styles.iconBtn} onClick={copyLink} title={copied ? 'Copied' : 'Copy link'}>
                  {copied ? <Check size={15} /> : <Link2 size={15} />}
                </button>
                {activeDocument.visibility === 'public' && (
                  <button
                    className={`${styles.iconBtn} ${copiedShare ? styles.iconBtnSuccess : ''}`}
                    onClick={copyShareLink}
                    title={copiedShare ? 'Link copied!' : 'Copy public share link'}
                  >
                    {copiedShare ? <Check size={15} /> : <Share2 size={15} />}
                  </button>
                )}
                {isOwner && (
                  <button className={styles.iconBtn} onClick={() => setShowAccessModal(true)} title="Document access settings">
                    <Settings2 size={16} />
                  </button>
                )}
              </>
            ) : (
              <span className={styles.lockBadge} title="View only">
                <Lock size={15} />
              </span>
            )}
          </div>
        </header>

        {showAccessModal && isOwner && (
          <SlidNoteAccessModal
            noteTitle={activeDocument.title || 'Untitled Slid Note'}
            ownerUser={ownerUser}
            users={orgUsers}
            currentUser={currentUser}
            initialEditorIds={Array.isArray(activeDocument.editor_ids) ? activeDocument.editor_ids : []}
            onClose={() => setShowAccessModal(false)}
            onSave={saveEditorAccess}
          />
        )}

        {canEdit && writingToolbar}

        <main
          ref={editorRef}
          className={styles.editorCanvas}
        >
          <div className={styles.paper}>
            {(activeDocument.blocks || []).map((block, index) => (
              <section
                key={block.id}
                className={`${styles.blockShell} ${activeBlockId === block.id ? styles.blockShellActive : ''}`}
                onFocusCapture={() => {
                  setActiveBlockId(block.id);
                }}
              >
                {canEdit && (
                  <div className={styles.blockTools}>
                    <button onClick={() => moveBlock(block.id, -1)} disabled={index === 0} title="Move up">
                      <ChevronLeft size={14} />
                    </button>
                    <button onClick={() => moveBlock(block.id, 1)} disabled={index === activeDocument.blocks.length - 1} title="Move down">
                      <ChevronRight size={14} />
                    </button>
                    <button onClick={() => deleteBlock(block.id)} title="Delete block">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                {renderBlock(block, index)}
              </section>
            ))}
            {canEdit && (
              <div className={styles.addStrip}>
                {blockOptions.map(option => {
                  const Icon = option.icon;
                  return (
                    <button key={option.type} onClick={() => addBlock(option.type)} title={option.label}>
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>
        {previewSrc && <ImageLightbox src={previewSrc} onClose={() => setPreviewSrc(null)} />}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search Slid Notes..."
          />
        </div>
        <button className={styles.newBtn} onClick={handleCreate}>
          <Plus size={15} /> New Slid Note
        </button>
      </div>

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.empty}>
            <FileText size={48} strokeWidth={1.2} />
            <p>Loading Slid Notes...</p>
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className={styles.empty}>
            <FileText size={48} strokeWidth={1.2} />
            <p>No Slid Notes yet. Create a freeform block document.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {visibleDocuments.map(doc => {
              const excerpt = (doc.blocks || []).map(getBlockText).join(' ').replace(/\s+/g, ' ').trim();
              const canDeleteDoc = currentUser?.role === 'admin' || sameId(doc.owner_id, currentUser?.id);
              const thumbnail = getThumbnail(doc.blocks);
              const owner = users.find(user => sameId(user.id, doc.owner_id));
              return (
                <article key={doc.id} className={styles.card} onClick={() => onOpenNote(doc.id)}>
                  {thumbnail && (
                    <div className={styles.cardThumbnail}>
                      {thumbnail.type === 'video' ? (
                        <video src={resolveMediaUrl(thumbnail.url)} muted preload="metadata" />
                      ) : (
                        <img src={resolveMediaUrl(thumbnail.url)} alt="" />
                      )}
                    </div>
                  )}
                  <div className={styles.cardBody}>
                    <h3>{doc.title || 'Untitled Slid Note'}</h3>
                    <p>{excerpt || 'Blank note'}</p>
                  </div>
                  <div className={styles.cardFooter}>
                    <span>{formatDate(doc.updated_at || doc.created_at)}</span>
                    {owner && <UserAvatar user={owner} size={22} title={owner.name} />}
                  </div>
                  {canDeleteDoc && (
                    <button
                      className={styles.cardDeleteBtn}
                      onClick={event => {
                        event.stopPropagation();
                        setConfirmDeleteId(doc.id);
                      }}
                      title="Delete Slid Note"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {confirmDeleteId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            style={{ background: 'var(--bg-surface)', borderRadius: 'var(--border-radius-md)', padding: '28px 32px', maxWidth: 380, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>Delete Slid Note</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to delete this Slid Note? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDeleteId(null)}
                style={{ padding: '8px 18px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-main)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteDocument(confirmDeleteId); setConfirmDeleteId(null); }}
                style={{ padding: '8px 18px', borderRadius: 'var(--border-radius-sm)', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlidNote;
