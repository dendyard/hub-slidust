import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, Panel,
  addEdge, applyNodeChanges, applyEdgeChanges,
  useReactFlow, useViewport, ReactFlowProvider, NodeResizer,
  Handle, Position, ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useData, resolveUploadUrl } from '../../context/DataContext';
import UserAvatar, { getAvatarColor, hasRealAvatar } from '../ui/UserAvatar';
import { ArrowLeft, Save, Square, Diamond, Circle, Type, Trash2, Pencil, Database, StickyNote, ChevronRight, Hexagon, X, AlignLeft, AlignCenter, AlignRight, PersonStanding, Lock, Link2, Check, Globe2, Settings2, UserPlus, Search, Image as ImageIcon, ArrowBigRight, ArrowBigLeft, ArrowBigUp, ArrowBigDown, Scan } from 'lucide-react';
import styles from './FlowEditor.module.css';

/* ── Constants ── */
const COLORS = ['#000000','#ffffff','#6366f1','#3b82f6','#22c55e','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6'];
const STICKY_COLORS = ['#FFEF91','#468432','#FFA02E','#FF70BF'];

/* ── Image compression — preserves transparency, targets maxBytes ── */
const compressImageDataUrl = (dataUrl, maxBytes = 300 * 1024) =>
  new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Sample a small version to detect alpha channel
      const sw = Math.min(w, 64), sh = Math.min(h, 64);
      canvas.width = sw; canvas.height = sh;
      ctx.drawImage(img, 0, 0, sw, sh);
      const pixels = ctx.getImageData(0, 0, sw, sh).data;
      let hasAlpha = false;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] < 255) { hasAlpha = true; break; }
      }

      // WebP for transparency (supports quality + alpha), JPEG for opaque
      const fmt = hasAlpha ? 'image/webp' : 'image/jpeg';

      const render = (width, height, quality) => {
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        if (!hasAlpha) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL(fmt, quality);
      };

      const byteSize = (url) => {
        const b64 = url.split(',')[1] || '';
        return Math.ceil(b64.length * 3 / 4);
      };

      const MAX_DIM = 1920;
      if (w > MAX_DIM || h > MAX_DIM) {
        const r = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }

      let quality = 0.85;
      let result = render(w, h, quality);

      // Step 1: reduce quality
      while (byteSize(result) > maxBytes && quality > 0.15) {
        quality = Math.max(0.15, quality - 0.1);
        result = render(w, h, quality);
      }

      // Step 2: reduce dimensions
      while (byteSize(result) > maxBytes && w > 200) {
        w = Math.round(w * 0.75);
        h = Math.round(h * 0.75);
        result = render(w, h, quality);
      }

      resolve(result);
    };
    img.src = dataUrl;
  });

/* ── Context for inline-edit callback ── */
const EditCtx = createContext(null);

/* ── Mini avatar for sticky note header ── */
const StickyMiniAvatar = ({ name = '', avatar = '', size = 20 }) => {
  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0 };
  if (hasRealAvatar(avatar)) {
    return <img src={resolveUploadUrl(avatar)} alt={name} style={{ ...base, objectFit: 'cover' }} />;
  }
  const initial = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      ...base, background: getAvatarColor(name), color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.42, userSelect: 'none', fontFamily: 'sans-serif',
    }}>{initial}</div>
  );
};

/* ── Arrow icon for handles ── */
const ArrowIcon = ({ rotation = 0 }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    style={{ transform: `rotate(${rotation}deg)`, display: 'block', pointerEvents: 'none' }}
  >
    <path d="M9.001 10.978H5.75C5.338 10.978 5 10.643 5 10.226C5 10.038 5.071 9.851 5.206 9.708C6.891 7.933 9.898 4.763 11.275 3.312C11.464 3.112 11.727 3 12 3C12.274 3 12.536 3.112 12.725 3.312C14.102 4.763 17.11 7.933 18.793 9.708C18.929 9.851 19 10.038 19 10.226C19 10.643 18.663 10.978 18.25 10.978H14.999V19.998C14.999 20.529 14.529 21 13.999 21H10.001C9.471 21 9.001 20.529 9.001 19.998V10.978Z" fill="#A7A7A7"/>
  </svg>
);

/* ── Reusable connection handles (all 4 sides) ── */
const HANDLE_STYLE = {
  width: 16, height: 16,
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const NodeHandles = () => (
  <>
    <Handle type="source" id="top"    position={Position.Top}    style={HANDLE_STYLE}><ArrowIcon rotation={0}   /></Handle>
    <Handle type="source" id="right"  position={Position.Right}  style={HANDLE_STYLE}><ArrowIcon rotation={90}  /></Handle>
    <Handle type="source" id="bottom" position={Position.Bottom} style={HANDLE_STYLE}><ArrowIcon rotation={180} /></Handle>
    <Handle type="source" id="left"   position={Position.Left}   style={HANDLE_STYLE}><ArrowIcon rotation={270} /></Handle>
  </>
);

/* ── ShapeNode ── */
const ShapeNode = ({ data, selected, id }) => {
  const onEdit = useContext(EditCtx);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const inputRef = useRef(null);

  const shape = data.shape || 'rect';
  const bg    = data.color  || '#6366f1';
  const bw    = data.borderWidth  || 0;
  const bc    = data.borderColor  || '#000000';
  const bs    = data.borderStyle  || 'solid';
  const cssBorderStyle = bs === 'dash' ? 'dashed' : bs === 'dots' ? 'dotted' : 'solid';
  const svgDash        = bs === 'dash' ? '8 4'    : bs === 'dots' ? '3 5'   : undefined;
  const defaultTextColor = bg === 'transparent' ? 'var(--text-main)' : '#ffffff';
  const textColor = data.fontColor || defaultTextColor;

  useEffect(() => {
    if (editing) {
      setDraft(data.label || '');
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 10);
    }
  }, [editing]);

  useEffect(() => {
    if (data.editTrigger) setEditing(true);
  }, [data.editTrigger]);

  const startEdit = (e) => { e.stopPropagation(); setEditing(true); };
  const commit    = ()  => { onEdit?.(id, draft); setEditing(false); };
  const onKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter')  commit();
    if (e.key === 'Escape') setEditing(false);
  };

  /* Handles & resizer are siblings at the node root → correct handle positions */
  if (shape === 'person') {
    return (
      <>
        <NodeHandles />
        <NodeResizer isVisible={selected} minWidth={40} minHeight={80} />
        <div
          style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', cursor: 'default', paddingBottom: 4, boxSizing: 'border-box' }}
          onDoubleClick={startEdit}
        >
          <PersonStanding
            color={bg}
            strokeWidth={1.5}
            style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', height: '85%' }}
          />
          <div style={{ position: 'relative', zIndex: 1, fontSize: '11px', fontWeight: 600, color: textColor, textAlign: 'center', lineHeight: 1.2 }}>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onKeyDown}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: textColor, fontSize: '11px', fontWeight: 600, textAlign: 'center', width: '80px' }}
              />
            ) : data.label}
          </div>
        </div>
      </>
    );
  }

  if (shape === 'database') {
    return (
      <>
        <NodeHandles />
        <NodeResizer isVisible={selected} minWidth={80} minHeight={60} />
        <div
          style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
          onDoubleClick={startEdit}
        >
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="4" y="18" width="92" height="66" fill={bg} />
            <ellipse cx="50" cy="84" rx="46" ry="13" fill={bg} stroke={bw > 0 ? bc : 'none'} strokeWidth={bw > 0 ? bw : 0} strokeDasharray={bw > 0 ? svgDash : undefined} vectorEffect="non-scaling-stroke" />
            <ellipse cx="50" cy="18" rx="46" ry="13" fill={bg} stroke={bw > 0 ? bc : 'rgba(255,255,255,0.25)'} strokeWidth={bw > 0 ? bw : 1} strokeDasharray={bw > 0 ? svgDash : undefined} vectorEffect="non-scaling-stroke" />
            {bw > 0 && <><line x1="4" y1="18" x2="4" y2="84" stroke={bc} strokeWidth={bw} strokeDasharray={svgDash} vectorEffect="non-scaling-stroke" /><line x1="96" y1="18" x2="96" y2="84" stroke={bc} strokeWidth={bw} strokeDasharray={svgDash} vectorEffect="non-scaling-stroke" /></>}
          </svg>
          <div style={{ position: 'relative', zIndex: 1, color: textColor, fontSize: '12px', fontWeight: 600, textAlign: 'center', padding: '0 12px' }}>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onKeyDown}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: textColor, fontSize: '12px', fontWeight: 600, textAlign: 'center', width: '80px' }}
              />
            ) : data.label}
          </div>
        </div>
      </>
    );
  }

  if (shape === 'sticky') {
    const fontColor = data.fontColor || '#222831';
    const stickyKeyDown = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') commit();
    };
    return (
      <>
        <NodeResizer isVisible={selected && !editing} minWidth={80} minHeight={60} />
        <div
          style={{
            width: '100%', height: '100%', position: 'relative', cursor: 'default', overflow: 'hidden',
            background: bg, borderRadius: 2,
            border: bw > 0 ? `${bw}px ${cssBorderStyle} ${bc}` : 'none',
            outline: 'none',
            boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
          }}
          onDoubleClick={startEdit}
        >
          {/* Header: avatar + name + datetime */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 8px 0 8px',
            flexShrink: 0,
          }}>
            <StickyMiniAvatar name={data.ownerName || ''} avatar={data.ownerAvatar || ''} size={22} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{
                fontSize: '11px', fontWeight: 600, color: fontColor,
                opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'sans-serif',
              }}>{data.ownerName || 'Unknown'}</span>
              <span style={{
                fontSize: '8px', color: fontColor, opacity: 0.5, whiteSpace: 'nowrap',
                fontFamily: 'sans-serif', marginTop: '-4px',
              }}>
                {data.createdAt ? (() => {
                  const d = new Date(data.createdAt);
                  const dd = String(d.getDate()).padStart(2,'0');
                  const mm = String(d.getMonth()+1).padStart(2,'0');
                  const yyyy = d.getFullYear();
                  const hh = String(d.getHours()).padStart(2,'0');
                  const min = String(d.getMinutes()).padStart(2,'0');
                  const ss = String(d.getSeconds()).padStart(2,'0');
                  return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
                })() : ''}
              </span>
            </div>
          </div>

          {/* Body: text content */}
          <div style={{
            color: fontColor, fontSize: '18px', fontWeight: 500,
            fontFamily: "inherit",
            padding: '4px 10px 8px 10px', flex: 1, overflow: 'hidden', boxSizing: 'border-box', lineHeight: 1.3, fontWeight: 400,
          }}>
            {editing ? (
              <textarea
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={stickyKeyDown}
                style={{
                  background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                  color: fontColor, fontSize: '18px', fontWeight: 500,
                  width: '100%', height: '100%', boxSizing: 'border-box',
                  fontFamily: "inherit", lineHeight: 1.3, fontWeight: 400, padding: 0, margin: 0,
                  overflow: 'auto', display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}
              />
            ) : (
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', pointerEvents: 'none' }}>{data.label}</span>
            )}
          </div>
        </div>
      </>
    );
  }

  if (shape === 'step') {
    return (
      <>
        <NodeHandles />
        <NodeResizer isVisible={selected} minWidth={80} minHeight={40} />
        <div
          style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
          onDoubleClick={startEdit}
        >
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="0,0 80,0 100,50 80,100 0,100" fill={bg}
              stroke={bw > 0 ? bc : 'transparent'}
              strokeWidth={bw > 0 ? bw : 0}
              strokeDasharray={bw > 0 ? svgDash : undefined}
              vectorEffect="non-scaling-stroke" />
          </svg>
          <div style={{ position: 'relative', zIndex: 1, color: textColor, fontSize: '12px', fontWeight: 600, textAlign: 'center', padding: '0 20px 0 8px' }}>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onKeyDown}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: '12px', fontWeight: 600, textAlign: 'center', width: '80px' }}
              />
            ) : data.label}
          </div>
        </div>
      </>
    );
  }

  if (shape === 'io') {
    return (
      <>
        <NodeHandles />
        <NodeResizer isVisible={selected} minWidth={80} minHeight={40} />
        <div
          style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
          onDoubleClick={startEdit}
        >
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="15,0 100,0 85,100 0,100" fill={bg}
              stroke={bw > 0 ? bc : 'transparent'}
              strokeWidth={bw > 0 ? bw : 0}
              strokeDasharray={bw > 0 ? svgDash : undefined}
              vectorEffect="non-scaling-stroke" />
          </svg>
          <div style={{ position: 'relative', zIndex: 1, color: textColor, fontSize: '12px', fontWeight: 600, textAlign: 'center', padding: '0 12px' }}>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onKeyDown}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: '12px', fontWeight: 600, textAlign: 'center', width: '80px' }}
              />
            ) : data.label}
          </div>
        </div>
      </>
    );
  }

  if (shape === 'diamond') {
    return (
      <>
        <NodeHandles />
        <NodeResizer isVisible={selected} minWidth={80} minHeight={50} />
        <div
          style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
          onDoubleClick={startEdit}
        >
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="50,4 96,50 50,96 4,50" fill={bg}
              stroke={bw > 0 ? bc : 'transparent'}
              strokeWidth={bw > 0 ? bw : 0}
              strokeDasharray={bw > 0 ? svgDash : undefined}
              vectorEffect="non-scaling-stroke" />
          </svg>
          <div style={{ position: 'relative', zIndex: 1, color: textColor, fontSize: '12px', fontWeight: 600, textAlign: 'center', padding: '0 12px' }}>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onKeyDown}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: textColor, fontSize: '12px', fontWeight: 600, textAlign: 'center', width: '80px' }}
              />
            ) : data.label}
          </div>
        </div>
      </>
    );
  }

  if (shape === 'arrow') {
    const dir = data.arrowDir || 'right';
    const svgTransform = dir === 'left' ? 'scaleX(-1)' : dir === 'up' ? 'rotate(-90deg)' : dir === 'down' ? 'rotate(90deg)' : 'none';
    return (
      <>
        <NodeHandles />
        <NodeResizer isVisible={selected} minWidth={60} minHeight={40} />
        <div
          style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
          onDoubleClick={startEdit}
        >
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', transform: svgTransform, transformOrigin: 'center' }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="0,28 58,28 58,8 100,50 58,92 58,72 0,72"
              fill={bg}
              stroke={bw > 0 ? bc : 'transparent'}
              strokeWidth={bw > 0 ? bw : 0}
              strokeDasharray={bw > 0 ? svgDash : undefined}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div style={{ position: 'relative', zIndex: 1, color: textColor, fontSize: '12px', fontWeight: 600, textAlign: 'center', padding: '0 16px 0 8px' }}>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={onKeyDown}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: textColor, fontSize: '12px', fontWeight: 600, textAlign: 'center', width: '80px' }}
              />
            ) : data.label}
          </div>
        </div>
      </>
    );
  }

  const visualStyle = {
    background: bg, color: textColor,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: 600,
    width: '100%', height: '100%',
    border: bw > 0 ? `${bw}px ${cssBorderStyle} ${bc}` : 'none',
    outline: 'none',
    wordBreak: 'break-word', textAlign: 'center',
    boxSizing: 'border-box', cursor: 'default',
    borderRadius: shape === 'rect' ? '8px' : shape === 'rounded' ? '999px' : 0,
  };

  return (
    <>
      <NodeHandles />
      <NodeResizer isVisible={selected} minWidth={80} minHeight={40} />
      <div style={visualStyle} onDoubleClick={startEdit}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: textColor, fontSize: '13px', fontWeight: 600, textAlign: 'center', width: '80%' }}
          />
        ) : (
          <span style={{ pointerEvents: 'none' }}>{data.label}</span>
        )}
      </div>
    </>
  );
};

/* ── TextNode — multiline, auto-height ── */
const TextNode = ({ data, selected, id }) => {
  const onEdit    = useContext(EditCtx);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const taRef = useRef(null);

  const autoResize = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  useEffect(() => {
    if (editing) {
      setDraft(data.label || '');
      setTimeout(() => {
        taRef.current?.focus();
        taRef.current?.select();
        autoResize(taRef.current);
      }, 10);
    }
  }, [editing]);

  useEffect(() => {
    if (data.editTrigger) setEditing(true);
  }, [data.editTrigger]);

  const startEdit = (e) => { e.stopPropagation(); setEditing(true); };
  const commit    = ()  => {
    const height = taRef.current ? taRef.current.scrollHeight + 20 : undefined;
    onEdit?.(id, draft, height);
    setEditing(false);
  };
  const onKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') commit();
  };

  const textStyle = {
    fontSize:   data.fontSize   || 12,
    fontWeight: data.fontWeight || 400,
    fontStyle:  data.fontStyle  || 'normal',
    textAlign:  data.align      || 'left',
    color:      data.color      || 'var(--text-main)',
    lineHeight: 1.4,
  };

  return (
    <>
      <NodeHandles />
      <NodeResizer isVisible={selected && !editing} minWidth={60} minHeight={24} />
      <div
        style={{
          ...textStyle,
          padding: '6px 10px', background: 'transparent',
          outline: selected && !editing ? '1.5px dashed var(--color-primary)' : 'none',
          borderRadius: 4,
          width: '100%', height: editing ? 'auto' : '100%',
          minHeight: '100%',
          boxSizing: 'border-box',
          cursor: 'default', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          overflow: 'hidden',
        }}
        onDoubleClick={startEdit}
      >
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={e => { setDraft(e.target.value); autoResize(e.target); }}
            onBlur={commit}
            onKeyDown={onKeyDown}
            style={{
              background: 'transparent', border: 'none', outline: 'none', resize: 'none',
              overflow: 'hidden', padding: 0, margin: 0,
              width: '100%', height: 'auto',
              fontSize: 'inherit', fontWeight: 'inherit', fontStyle: 'inherit',
              color: 'inherit', textAlign: 'inherit', lineHeight: 'inherit',
              fontFamily: 'inherit', display: 'block', boxSizing: 'border-box',
            }}
          />
        ) : (
          <span style={{ pointerEvents: 'none', whiteSpace: 'pre-wrap' }}>{data.label}</span>
        )}
      </div>
    </>
  );
};

/* ── ImageNode ── */
const ImageNode = ({ data, selected }) => (
  <>
    <NodeHandles />
    <NodeResizer isVisible={selected} minWidth={40} minHeight={40} />
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 4, position: 'relative' }}>
      <img
        src={data.src}
        alt={data.label || ''}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
        draggable={false}
      />
    </div>
  </>
);

/* ── Zoom label (rendered inside ReactFlow so useViewport is in scope) ── */
const ZoomLabel = () => {
  const { zoom } = useViewport();
  return (
    <Panel position="bottom-left" style={{ marginLeft: 46, marginBottom: 8, pointerEvents: 'none' }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
        borderRadius: 6, padding: '3px 8px',
        fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)',
      }}>
        {Math.round(zoom * 100)}%
      </div>
    </Panel>
  );
};

/* nodeTypes must be stable (defined outside component) */
/* Exported so the read-only public preview (FlowPreview.jsx) reuses the exact
   same node renderers — keeps the shared view pixel-identical to the editor. */
export const nodeTypes = { shape: ShapeNode, text: TextNode, image: ImageNode };

/* ── NODE TOOLS CONFIG ── */
const NODE_TOOLS = [
  { type: 'text',  shape: null,       label: 'Text',     icon: Type,          w: 120, h: 36  },
  { type: 'shape', shape: 'sticky',   label: 'Note',     icon: StickyNote,    w: 150, h: 130, defaultColor: '#FFEF91' },
  { type: 'shape', shape: 'zone',     label: '',         icon: Scan,          w: 140, h: 60,  defaultColor: 'transparent', defaultBorderColor: '#ef4444', defaultBorderWidth: 3, defaultFontColor: '#ef4444' },
  { type: 'shape', shape: 'rect',     label: 'Process',  icon: Square,        w: 140, h: 60  },
  { type: 'shape', shape: 'step',     label: 'Step',     icon: ChevronRight,  w: 140, h: 60  },
  { type: 'shape', shape: 'io',       label: 'I/O',      icon: Hexagon,       w: 140, h: 60  },
  { type: 'shape', shape: 'diamond',  label: 'Decision', icon: Diamond,       w: 120, h: 120 },
  { type: 'shape', shape: 'rounded',  label: 'Terminal', icon: Circle,        w: 140, h: 56  },
  { type: 'shape', shape: 'database', label: 'Database', icon: Database,      w: 120, h: 100, defaultColor: '#3b82f6' },
  { type: 'shape', shape: 'person',   label: 'User',     icon: PersonStanding, w: 80,  h: 90,  defaultColor: '#000000' },
  { type: 'shape', shape: 'arrow',    label: 'Arrow',    icon: ArrowBigRight,  w: 140, h: 60,  defaultColor: '#6366f1' },
];

const FlowAccessModal = ({ flowName, ownerUser, users, currentUser, initialEditorIds = [], onClose, onSave }) => {
  const [search, setSearch] = useState('');
  const [editorIds, setEditorIds] = useState(initialEditorIds);

  const candidateUsers = users
    .filter(user => user.id !== ownerUser?.id)
    .filter(user => {
      const keyword = search.trim().toLowerCase();
      if (!keyword) return true;
      return user.name?.toLowerCase().includes(keyword) || user.username?.toLowerCase().includes(keyword);
    });

  const toggleEditor = (userId) => {
    setEditorIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  return (
    <div className={styles.flowAccessOverlay} onClick={onClose}>
      <div className={styles.flowAccessModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.flowAccessHeader}>
          <div className={styles.flowAccessTitle}>
            <h3>Flow Access</h3>
            <p>Choose who can edit "{flowName}". Owner always has edit access.</p>
          </div>
          <button className={styles.topIconBtn} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.flowAccessBody}>
          {ownerUser && (
            <div className={styles.flowAccessRow}>
              <UserAvatar user={ownerUser} size={34} />
              <div className={styles.flowAccessInfo}>
                <span className={styles.flowAccessName}>{ownerUser.name} {ownerUser.id === currentUser?.id ? '(You)' : ''}</span>
                <span className={styles.flowAccessMeta}>Owner</span>
              </div>
              <button className={`${styles.flowAccessToggle} ${styles.flowAccessToggleActive}`} disabled>
                <Lock size={14} /> Owner
              </button>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className={styles.flowAccessSearch}
              style={{ paddingLeft: 34 }}
              placeholder="Search user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.flowAccessList}>
            {candidateUsers.length === 0 ? (
              <div className={styles.flowAccessEmpty}>No users found.</div>
            ) : candidateUsers.map(user => {
              const isEditor = editorIds.includes(user.id);
              return (
                <div key={user.id} className={styles.flowAccessRow}>
                  <UserAvatar user={user} size={34} />
                  <div className={styles.flowAccessInfo}>
                    <span className={styles.flowAccessName}>{user.name}</span>
                    <span className={styles.flowAccessMeta}>@{user.username} · {user.role}</span>
                  </div>
                  <button
                    className={`${styles.flowAccessToggle} ${isEditor ? styles.flowAccessToggleActive : ''}`}
                    onClick={() => toggleEditor(user.id)}
                  >
                    <UserPlus size={14} /> {isEditor ? 'Can Edit' : 'Grant Edit'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.flowAccessFooter}>
          <button className={styles.flowAccessCancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.flowAccessSaveBtn} onClick={() => onSave(editorIds)}>Save Access</button>
        </div>
      </div>
    </div>
  );
};

/* ── Inner editor (needs ReactFlowProvider context) ── */
const EditorInner = ({ flowId, flowName: initialName, initialVisibility = 'public', initialEditorIds = [], ownerUser = null, initialData, onBack, onSave, onVisibilityChange, onEditorsChange, canEdit }) => {
  const { currentUser, users, organizationMembers } = useData();

  const activeOrgId  = currentUser?.active_organization_id ?? null;
  const orgUserIds   = activeOrgId
    ? new Set(organizationMembers.filter(m => m.organization_id === activeOrgId).map(m => m.user_id))
    : null;
  const orgUsers = orgUserIds ? users.filter(u => orgUserIds.has(u.id)) : users;
  const [nodes, setNodes] = useState(
    (initialData?.nodes || []).map(n => ({ ...n, selected: false, data: { ...n.data, editTrigger: 0 } }))
  );
  const [edges, setEdges] = useState(
    (initialData?.edges || []).map(e => ({
      ...e,
      selected: false,
      style: { strokeWidth: 1, stroke: '#000000', ...e.style },
      markerEnd: { type: 'arrowclosed', color: '#000000', ...e.markerEnd },
      pathOptions: { offset: 0, borderRadius: 4, ...e.pathOptions },
    }))
  );
  const [flowName, setFlowName]   = useState(initialName);
  const [flowVisibility, setFlowVisibility] = useState(initialVisibility || 'public');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState(initialName);
  const [flowEditorIds, setFlowEditorIds] = useState(initialEditorIds);
  const [selectedId, setSelectedId]         = useState(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState([]);
  const [guideLines, setGuideLines]           = useState([]);
  const [dirty, setDirty]             = useState(false);
  const [saving, setSaving]           = useState(false);
  const [showExitPrompt, setShowExitPrompt]   = useState(false);
  const [showSavingPrompt, setShowSavingPrompt] = useState(false);
  const pendingBackRef = useRef(false);
  const [contextMenu, setContextMenu] = useState(null); // { nodeId, x, y }
  const [panelVisible, setPanelVisible] = useState(true);
  const [pendingTool, setPendingTool] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const draggingNodeIdRef = useRef(null);
  const editorUsers = flowEditorIds
    .map(editorId => users.find(user => user.id === editorId))
    .filter(Boolean);

  const { screenToFlowPosition, setViewport, fitView } = useReactFlow();
  const viewport = useViewport();
  const idRef = useRef(1);
  const canvasRef = useRef(null);
  const readyRef = useRef(false);
  const imageInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (nodes.length > 0) {
      fitView({ padding: 0.2, duration: 200 });
    } else {
      setViewport({ x: 0, y: 0, zoom: 1.3 });
    }
    const timer = setTimeout(() => { readyRef.current = true; }, 800);
    return () => clearTimeout(timer);
  }, []);

  const selectedNode = nodes.find(n => n.id === selectedId) || null;
  const selectedEdge = selectedEdgeIds.length === 1 ? edges.find(e => e.id === selectedEdgeIds[0]) : null;

  const onNodesChange = useCallback(changes => {
    if (!canEdit) return;
    setNodes(nds => applyNodeChanges(changes, nds));
    if (readyRef.current) setDirty(true);
  }, [canEdit]);

  const onEdgesChange = useCallback(changes => {
    if (!canEdit) return;
    setEdges(eds => applyEdgeChanges(changes, eds));
    if (readyRef.current) setDirty(true);
  }, [canEdit]);

  /* Animated "live" edges on connect */
  const onConnect = useCallback(params => {
    if (!canEdit) return;
    setEdges(eds => addEdge({
      ...params,
      type: 'smoothstep',
      markerEnd: { type: 'arrowclosed', color: '#000000' },
      style: { strokeWidth: 1, stroke: '#000000' },
      pathOptions: { offset: 20, borderRadius: 4 },
    }, eds));
    setDirty(true);
  }, [canEdit]);

  const onSelectionChange = useCallback(({ nodes: sNodes, edges: sEdges }) => {
    setSelectedId(sNodes.length === 1 ? sNodes[0].id : null);
    setSelectedEdgeIds(sEdges.map(e => e.id));
    setPanelVisible(true);
  }, []);

  /* Alignment snap + guide lines */
  const SNAP_THRESHOLD = 8;
  const lastSnapRef  = useRef({});
  const edgesRef     = useRef(edges);
  const nodesRef     = useRef(nodes);
  const copiedNodeRef = useRef(null);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const onNodeDrag = useCallback((_, draggedNode) => {
    if (!canEdit) return;
    if (draggingNodeIdRef.current !== draggedNode.id) {
      draggingNodeIdRef.current = draggedNode.id;
      setPanelVisible(false);
    }
    const dw = draggedNode.measured?.width  || Number(draggedNode.style?.width)  || 140;
    const dh = draggedNode.measured?.height || Number(draggedNode.style?.height) || 60;
    const dx = draggedNode.position.x;
    const dy = draggedNode.position.y;
    const dCX = dx + dw / 2, dCY = dy + dh / 2;
    const dR  = dx + dw,     dB  = dy + dh;

    let snapX = null, snapY = null;
    const lines = [];

    /* IDs of nodes connected to dragged node via an edge */
    const connectedIds = new Set(
      edgesRef.current
        .filter(e => e.source === draggedNode.id || e.target === draggedNode.id)
        .map(e => e.source === draggedNode.id ? e.target : e.source)
    );

    setNodes(nds => {
      for (const node of nds) {
        if (node.id === draggedNode.id) continue;
        const nw  = node.measured?.width  || Number(node.style?.width)  || 140;
        const nh  = node.measured?.height || Number(node.style?.height) || 60;
        const nx  = node.position.x, ny  = node.position.y;
        const nCX = nx + nw / 2,     nCY = ny + nh / 2;
        const nR  = nx + nw,         nB  = ny + nh;
        const isConnected = connectedIds.has(node.id);

        if (snapX === null) {
          if      (Math.abs(dx  - nx)  < SNAP_THRESHOLD) { snapX = nx;          lines.push({ type: 'v', x: nx  }); }
          else if (Math.abs(dR  - nR)  < SNAP_THRESHOLD) { snapX = nR  - dw;    lines.push({ type: 'v', x: nR  }); }
          else if (Math.abs(dCX - nCX) < SNAP_THRESHOLD) { snapX = nCX - dw/2;  lines.push({ type: 'v', x: nCX }); }
          /* Straight vertical line: connected node center-X aligns with dragged center-X */
          else if (isConnected && Math.abs(dCX - nCX) < SNAP_THRESHOLD * 2) {
            snapX = nCX - dw/2; lines.push({ type: 'v', x: nCX });
          }
        }
        if (snapY === null) {
          if      (Math.abs(dy  - ny)  < SNAP_THRESHOLD) { snapY = ny;          lines.push({ type: 'h', y: ny  }); }
          else if (Math.abs(dB  - nB)  < SNAP_THRESHOLD) { snapY = nB  - dh;    lines.push({ type: 'h', y: nB  }); }
          else if (Math.abs(dCY - nCY) < SNAP_THRESHOLD) { snapY = nCY - dh/2;  lines.push({ type: 'h', y: nCY }); }
          /* Straight horizontal line: connected node center-Y aligns with dragged center-Y */
          else if (isConnected && Math.abs(dCY - nCY) < SNAP_THRESHOLD * 2) {
            snapY = nCY - dh/2; lines.push({ type: 'h', y: nCY });
          }
        }
      }

      setGuideLines(lines);

      if (snapX === null && snapY === null) {
        delete lastSnapRef.current[draggedNode.id];
        return nds;
      }

      const snappedPos = { x: snapX ?? dx, y: snapY ?? dy };
      lastSnapRef.current[draggedNode.id] = snappedPos;
      return nds.map(n => n.id === draggedNode.id ? { ...n, position: snappedPos } : n);
    });
  }, [canEdit]);

  const onNodeDragStop = useCallback((_, node) => {
    if (!canEdit) return;
    draggingNodeIdRef.current = null;
    setGuideLines([]);
    const snapped = lastSnapRef.current[node.id];
    if (snapped) {
      /* Re-apply snapped position — overrides ReactFlow's mouse-based final position */
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, position: snapped } : n));
      delete lastSnapRef.current[node.id];
    }
    setPanelVisible(true);
    setDirty(true);
  }, [canEdit]);

  /* Stable inline-edit callback provided via context */
  const handleNodeEdit = useCallback((id, label, height) => {
    if (!canEdit) return;
    setNodes(nds => nds.map(n => {
      if (n.id !== id) return n;
      const updated = { ...n, data: { ...n.data, label } };
      if (height !== undefined && n.type === 'text') {
        updated.style = { ...n.style, height };
      }
      return updated;
    }));
    setDirty(true);
  }, [canEdit]);

  const insertImageFile = useCallback((file, clientX, clientY) => {
    if (!canEdit) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImageDataUrl(ev.target.result);
      const img = new window.Image();
      img.onload = () => {
        const maxW = 320, maxH = 240;
        const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        const w = Math.round(img.naturalWidth * ratio);
        const h = Math.round(img.naturalHeight * ratio);
        const pos = screenToFlowPosition({ x: clientX, y: clientY });
        const id = `n${Date.now()}_${idRef.current++}`;
        setNodes(nds => [...nds, {
          id, type: 'image',
          position: { x: pos.x - w / 2, y: pos.y - h / 2 },
          style: { width: w, height: h },
          data: { src: compressed, label: file.name },
        }]);
        setDirty(true);
      };
      img.src = compressed;
    };
    reader.readAsDataURL(file);
  }, [canEdit, screenToFlowPosition]);

  const insertImageRef = useRef(insertImageFile);
  useEffect(() => { insertImageRef.current = insertImageFile; }, [insertImageFile]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onDragOver = (e) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
      }
    };
    const onDragLeave = (e) => {
      if (!el.contains(e.relatedTarget)) setIsDragOver(false);
    };
    const onDrop = (e) => {
      setIsDragOver(false);
      const imageFiles = Array.from(e.dataTransfer?.files || [])
        .filter(f => f.type === 'image/jpeg' || f.type === 'image/png');
      if (!imageFiles.length) return;
      e.preventDefault();
      imageFiles.forEach((file, i) => insertImageRef.current(file, e.clientX + i * 24, e.clientY + i * 24));
    };
    const onPaste = (e) => {
      if (!canEdit) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter(item => item.type.startsWith('image/'));
      if (!imageItems.length) return;
      e.preventDefault();
      const bounds = el.getBoundingClientRect();
      const cx = bounds.left + bounds.width / 2;
      const cy = bounds.top + bounds.height / 2;
      imageItems.forEach((item, i) => {
        const file = item.getAsFile();
        if (file) insertImageRef.current(file, cx + i * 24, cy + i * 24);
      });
    };
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, [canEdit]);

  const onImageFileInput = useCallback((e) => {
    if (!canEdit) return;
    const files = Array.from(e.target.files || []);
    const bounds = canvasRef.current?.getBoundingClientRect() || { left: 0, top: 0, width: 800, height: 600 };
    const cx = bounds.left + bounds.width / 2;
    const cy = bounds.top + bounds.height / 2;
    files.forEach((file, i) => insertImageFile(file, cx + i * 24, cy + i * 24));
    e.target.value = '';
  }, [canEdit, insertImageFile]);

  const addNode = (tool, flowPos) => {
    if (!canEdit) return;
    const id  = `n${Date.now()}_${idRef.current++}`;
    const newNode = {
      id,
      type: tool.type,
      position: { x: flowPos.x - tool.w / 2, y: flowPos.y - tool.h / 2 },
      style: { width: tool.w, height: tool.h },
      data: {
        label: tool.label,
        shape: tool.shape,
        color:       tool.type === 'text' ? 'var(--text-main)' : (tool.defaultColor ?? '#ffffff'),
        fontColor:   tool.type === 'text' ? undefined : (tool.defaultFontColor || (tool.defaultColor != null ? undefined : '#000000')),
        borderWidth: tool.type === 'text' ? 0 : (tool.defaultBorderWidth ?? (tool.defaultColor != null ? 0 : 1)),
        borderColor: tool.defaultBorderColor || '#000000',
        borderStyle: 'solid',
        ...(tool.shape === 'sticky' && {
          ownerName:   currentUser?.name   || '',
          ownerAvatar: currentUser?.avatar || '',
          createdAt:   new Date().toISOString(),
          fontColor:   '#222831',
          borderWidth: 0,
        }),
        ...(tool.shape === 'person' && {
          fontColor:   '#000000',
          borderWidth: 0,
        }),
      },
    };
    setNodes(nds => [...nds, newNode]);
    setDirty(true);
  };

  const deleteSelected = useCallback(() => {
    if (!canEdit) return;
    if (!selectedId && selectedEdgeIds.length === 0) return;
    if (selectedId) {
      setNodes(nds => nds.filter(n => n.id !== selectedId));
      setEdges(eds => eds.filter(e => e.source !== selectedId && e.target !== selectedId));
      setSelectedId(null);
    }
    if (selectedEdgeIds.length > 0) {
      setEdges(eds => eds.filter(e => !selectedEdgeIds.includes(e.id)));
      setSelectedEdgeIds([]);
    }
    setDirty(true);
  }, [canEdit, selectedId, selectedEdgeIds]);

  const onNodeContextMenu = useCallback((e, node) => {
    if (!canEdit) return;
    e.preventDefault();
    const bounds = e.currentTarget.closest('.react-flow')?.getBoundingClientRect() || { left: 0, top: 0 };
    setContextMenu({ nodeId: node.id, x: e.clientX - bounds.left, y: e.clientY - bounds.top });
  }, [canEdit]);

  const sendToBack = useCallback((nodeId) => {
    if (!canEdit) return;
    setNodes(nds => {
      const minZ = Math.min(0, ...nds.map(n => n.zIndex ?? 0));
      return nds.map(n => n.id === nodeId ? { ...n, zIndex: minZ - 1 } : n);
    });
    setDirty(true);
    setContextMenu(null);
  }, [canEdit]);

  const bringToFront = useCallback((nodeId) => {
    if (!canEdit) return;
    setNodes(nds => {
      const maxZ = Math.max(0, ...nds.map(n => n.zIndex ?? 0));
      return nds.map(n => n.id === nodeId ? { ...n, zIndex: maxZ + 1 } : n);
    });
    setDirty(true);
    setContextMenu(null);
  }, [canEdit]);

  useEffect(() => {
    const handler = (e) => {
      if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (canEdit && (e.key === 'Delete' || e.key === 'Backspace')) {
        deleteSelected();
      }
      if (e.key === 'Escape') {
        setPendingTool(null);
      }
      if (canEdit && e.key === 'Enter' && selectedId) {
        setNodes(nds => nds.map(n => n.id === selectedId
          ? { ...n, data: { ...n.data, editTrigger: (n.data.editTrigger || 0) + 1 } }
          : n
        ));
      }
      if (canEdit && (e.ctrlKey || e.metaKey) && e.key === 'c' && selectedId) {
        e.preventDefault();
        const node = nodesRef.current.find(n => n.id === selectedId);
        if (node) copiedNodeRef.current = node;
      }
      if (canEdit && (e.ctrlKey || e.metaKey) && e.key === 'v' && copiedNodeRef.current) {
        e.preventDefault();
        const src = copiedNodeRef.current;
        const id = `n${Date.now()}_${idRef.current++}`;
        setNodes(nds => [...nds, {
          ...src,
          id,
          selected: false,
          position: { x: src.position.x + 24, y: src.position.y + 24 },
          data: { ...src.data, editTrigger: 0 },
        }]);
        setDirty(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canEdit, deleteSelected, selectedId]);

  const updateLabel = (label) => {
    if (!canEdit) return;
    setNodes(nds => nds.map(n => n.id === selectedId ? { ...n, data: { ...n.data, label } } : n));
    setDirty(true);
  };

  const updateColor = (color) => {
    if (!canEdit) return;
    setNodes(nds => nds.map(n => n.id === selectedId ? { ...n, data: { ...n.data, color } } : n));
    setDirty(true);
  };

  const updateTextProp = (key, value) => {
    if (!canEdit) return;
    setNodes(nds => nds.map(n => n.id === selectedId ? { ...n, data: { ...n.data, [key]: value } } : n));
    setDirty(true);
  };

  const LINE_STYLES = {
    solid: undefined,
    dash:  '8 4',
    dots:  '3 5',
  };
  const getLineStyleKey = (edge) => {
    const da = edge?.style?.strokeDasharray;
    if (!da) return 'solid';
    if (String(da).startsWith('3')) return 'dots';
    return 'dash';
  };
  const updateEdgeLineStyle = (styleKey) => {
    if (!canEdit) return;
    setEdges(eds => eds.map(e => selectedEdgeIds.includes(e.id)
      ? { ...e, style: { ...e.style, strokeDasharray: LINE_STYLES[styleKey] } }
      : e
    ));
    setDirty(true);
  };

  const getMarkerType = (marker) => {
    if (!marker) return 'none';
    if (typeof marker === 'string') return marker.includes('bullet') ? 'bullet' : 'none';
    if (marker?.type) return 'arrow';
    return 'none';
  };

  const makeMarker = (type) => {
    if (type === 'arrow')  return { type: 'arrowclosed', color: '#000000' };
    if (type === 'bullet') return 'url(#flow-bullet)';
    return undefined;
  };

  const updateEdgeMarker = (which, type) => {
    if (!canEdit) return;
    const prop = which === 'start' ? 'markerStart' : 'markerEnd';
    const marker = makeMarker(type);
    setEdges(eds => eds.map(e => selectedEdgeIds.includes(e.id)
      ? { ...e, [prop]: marker }
      : e
    ));
    setDirty(true);
  };

  /* Inject bullet SVG marker defs into React Flow's SVG once on mount */
  useEffect(() => {
    const timer = setTimeout(() => {
      const svg = canvasRef.current?.querySelector('svg.react-flow__edges')
               ?? canvasRef.current?.querySelector('svg');
      if (!svg) return;
      svg.querySelector('#flow-bullet')?.remove();
      let defs = svg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
      }
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'flow-bullet');
      marker.setAttribute('markerWidth', '30');
      marker.setAttribute('markerHeight', '30');
      marker.setAttribute('refX', '10');
      marker.setAttribute('refY', '10');
      marker.setAttribute('markerUnits', 'userSpaceOnUse');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '10');
      circle.setAttribute('cy', '10');
      circle.setAttribute('r', '10');
      circle.setAttribute('fill', '#000000');
      marker.appendChild(circle);
      defs.appendChild(marker);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  /* Floating panel position — left of shape, top-aligned + 20px */
  const floatPos = useMemo(() => {
    if (selectedNode) {
      const node = nodes.find(n => n.id === selectedId);
      if (!node) return null;
      const sx = viewport.x + node.position.x * viewport.zoom;
      const sy = viewport.y + node.position.y * viewport.zoom;
      return { x: sx, y: sy + 20 };
    }
    if (selectedEdge && !selectedNode) {
      const src = nodes.find(n => n.id === selectedEdge.source);
      const tgt = nodes.find(n => n.id === selectedEdge.target);
      if (!src || !tgt) return null;
      const srcH = src.measured?.height || Number(src.style?.height) || 60;
      const tgtH = tgt.measured?.height || Number(tgt.style?.height) || 60;
      const srcLeft = viewport.x + src.position.x * viewport.zoom;
      const tgtLeft = viewport.x + tgt.position.x * viewport.zoom;
      const x = Math.min(srcLeft, tgtLeft);
      const srcCY = viewport.y + (src.position.y + srcH / 2) * viewport.zoom;
      const tgtCY = viewport.y + (tgt.position.y + tgtH / 2) * viewport.zoom;
      return { x, y: (srcCY + tgtCY) / 2 };
    }
    return null;
  }, [selectedNode, selectedEdge, selectedId, nodes, viewport]);

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await onSave(flowId, flowName, { nodes, edges });
      setDirty(false);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
      if (pendingBackRef.current) {
        pendingBackRef.current = false;
        setShowSavingPrompt(false);
        onBack();
      }
    }
  };

  const commitName = () => {
    if (!canEdit) {
      setEditingName(false);
      setNameInput(flowName);
      return;
    }
    setFlowName(nameInput.trim() || flowName);
    setEditingName(false);
    setDirty(true);
  };

  const handleVisibilityToggle = useCallback(async () => {
    if (!canEdit) return;
    const nextVisibility = flowVisibility === 'private' ? 'public' : 'private';
    setFlowVisibility(nextVisibility);
    try {
      await onVisibilityChange?.(flowId, nextVisibility);
    } catch (e) {
      setFlowVisibility(flowVisibility);
      console.error('Visibility update failed:', e);
    }
  }, [canEdit, flowId, flowVisibility, onVisibilityChange]);

  const handleCopyLink = useCallback(async () => {
    // Public, no-login share link (read-only preview). Works only while the flow
    // is Public; private flows resolve to a "not found" state on the preview page.
    const url = new URL(window.location.href);
    url.search = '';
    url.pathname = `/flow/preview/${flowId}`;
    try { await navigator.clipboard.writeText(url.toString()); }
    catch { window.prompt('Copy public link', url.toString()); }
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1600);
  }, [flowId]);

  const handleEditorAccessSave = useCallback(async (editorIds) => {
    setFlowEditorIds(editorIds);
    try {
      await onEditorsChange?.(flowId, editorIds);
      setShowAccessModal(false);
    } catch (e) {
      console.error('Editor access update failed:', e);
    }
  }, [flowId, onEditorsChange]);

  return (
    <EditCtx.Provider value={handleNodeEdit}>
      <div className={styles.editor}>

        {/* Top bar */}
        <div className={styles.topbar}>
          <div className={`${styles.topbarSide} ${styles.topbarLeft}`}>
            <button className={styles.backBtn} onClick={() => saving ? setShowSavingPrompt(true) : dirty ? setShowExitPrompt(true) : onBack()} title="Back">
              <ArrowLeft size={16} />
            </button>

            <button
              className={`${styles.visibilityBtn} ${flowVisibility === 'private' ? styles.visibilityPrivate : styles.visibilityPublic}`}
              onClick={handleVisibilityToggle}
              disabled={!canEdit}
              title={canEdit ? 'Toggle flow visibility' : 'Flow visibility'}
            >
              {flowVisibility === 'private' ? <Lock size={14} /> : <Globe2 size={14} />}
              {flowVisibility === 'private' ? 'Private Flow' : 'Public'}
            </button>
          </div>

          <div className={styles.fileTitle}>
            <div className={styles.fileTitleGroup}>
              {(ownerUser || editorUsers.length > 0) && (
                <div className={styles.fileAvatarStack}>
                  {ownerUser && (
                    <UserAvatar
                      className={styles.fileAvatar}
                      user={ownerUser}
                      size={26}
                      title={ownerUser.name || 'Owner'}
                    />
                  )}
                  {editorUsers.map(user => (
                    <UserAvatar
                      key={user.id}
                      className={styles.fileAvatar}
                      user={user}
                      size={26}
                      title={user.name || 'Editor'}
                    />
                  ))}
                </div>
              )}
              {editingName ? (
                <input
                  className={styles.titleInput}
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
                  autoFocus
                />
              ) : (
                <span
                  className={styles.titleText}
                  onClick={() => {
                    if (!canEdit) return;
                    setNameInput(flowName);
                    setEditingName(true);
                  }}
                  style={{ cursor: canEdit ? 'text' : 'default' }}
                >
                  {flowName}
                  {canEdit && (
                    <span className={styles.titleEditIcon} aria-hidden="true">
                      <Pencil size={13} />
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className={`${styles.topbarSide} ${styles.topbarRight}`}>
            {dirty && <span className={styles.dirtyDot} title="Unsaved changes" />}

            {canEdit ? (
              <>
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  <Save size={15} />
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button className={styles.topIconBtn} onClick={handleCopyLink} title={copiedLink ? 'Copied' : 'Copy link'}>
                  {copiedLink ? <Check size={15} /> : <Link2 size={15} />}
                </button>
                {ownerUser?.id === currentUser?.id && (
                  <button className={styles.topIconBtn} onClick={() => setShowAccessModal(true)} title="Flow access settings">
                    <Settings2 size={16} />
                  </button>
                )}
              </>
            ) : (
              <span
                title="View only"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-surface)',
                }}
              >
                <Lock size={15} />
              </span>
            )}
          </div>
        </div>

        {showAccessModal && ownerUser?.id === currentUser?.id && (
          <FlowAccessModal
            flowName={flowName}
            ownerUser={ownerUser}
            users={orgUsers}
            currentUser={currentUser}
            initialEditorIds={flowEditorIds}
            onClose={() => setShowAccessModal(false)}
            onSave={handleEditorAccessSave}
          />
        )}

        {/* Hidden image file input */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          style={{ display: 'none' }}
          onChange={onImageFileInput}
        />

        {/* Canvas */}
        <div
          className={styles.canvas}
          ref={canvasRef}
          style={isDragOver ? { outline: '2px dashed var(--color-primary)', outlineOffset: '-3px' } : undefined}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={(e) => {
              setContextMenu(null);
              if (pendingTool) {
                const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
                addNode(pendingTool, pos);
                setPendingTool(null);
              }
            }}
            connectionMode={ConnectionMode.Loose}
            proOptions={{ hideAttribution: true }}
            defaultViewport={{ x: 0, y: 0, zoom: 1.3 }}
            minZoom={0.1}
            deleteKeyCode={null}
            selectionOnDrag={canEdit}
            panOnScroll
            zoomOnScroll={false}
            zoomOnPinch
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable={canEdit}
            defaultEdgeOptions={{ style: { strokeWidth: 1, stroke: '#000000' }, markerEnd: { type: 'arrowclosed', color: '#000000' } }}
            connectionLineStyle={{ strokeWidth: 1, stroke: '#000000' }}
          >
            <Background variant="cross" gap={40} size={1} color="transparent" />
            <Controls />
            <ZoomLabel />
          </ReactFlow>

          {/* Placement overlay — captures cursor & click when a tool is pending */}
          {canEdit && pendingTool && (
            <div
              style={{
                position: 'absolute', inset: 0, zIndex: 200,
                cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cline x1='12' y1='3' x2='12' y2='21' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cline x1='3' y1='12' x2='21' y2='12' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3Cline x1='12' y1='3' x2='12' y2='21' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3Cline x1='3' y1='12' x2='21' y2='12' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 12 12, crosshair`,
              }}
              onClick={(e) => {
                const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
                addNode(pendingTool, pos);
                setPendingTool(null);
              }}
            />
          )}

          {/* Context menu */}
          {canEdit && contextMenu && (
            <div
              style={{
                position: 'absolute', left: contextMenu.x, top: contextMenu.y,
                background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                zIndex: 100, minWidth: 160, overflow: 'hidden',
              }}
              onMouseLeave={() => setContextMenu(null)}
            >
              {[
                { label: 'Copy',           action: () => { const node = nodesRef.current.find(n => n.id === contextMenu.nodeId); if (node) copiedNodeRef.current = node; setContextMenu(null); } },
                { label: 'Paste',          action: () => { if (!copiedNodeRef.current) return; const src = copiedNodeRef.current; const id = `n${Date.now()}_${idRef.current++}`; setNodes(nds => [...nds, { ...src, id, selected: false, position: { x: src.position.x + 24, y: src.position.y + 24 }, data: { ...src.data, editTrigger: 0 } }]); setDirty(true); setContextMenu(null); } },
                { label: 'Bring to Front', action: () => bringToFront(contextMenu.nodeId) },
                { label: 'Send to Back',   action: () => sendToBack(contextMenu.nodeId)   },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: 'block', width: '100%', padding: '9px 14px',
                    background: 'transparent', border: 'none', textAlign: 'left',
                    fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{item.label}</button>
              ))}
            </div>
          )}

          {/* Alignment guide lines */}
          {guideLines.length > 0 && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
              {guideLines.map((line, i) => line.type === 'v'
                ? <line key={i}
                    x1={viewport.x + line.x * viewport.zoom} y1={0}
                    x2={viewport.x + line.x * viewport.zoom} y2="100%"
                    stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" />
                : <line key={i}
                    x1={0}    y1={viewport.y + line.y * viewport.zoom}
                    x2="100%" y2={viewport.y + line.y * viewport.zoom}
                    stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" />
              )}
            </svg>
          )}

          {canEdit && pendingTool && (
            <div className={styles.toolbarHint}>
              Click on canvas to place: {pendingTool.label}
            </div>
          )}

          {/* Floating bottom toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.toolbarGroup}>
              {NODE_TOOLS.slice(0, 2).map(tool => {
                const Icon = tool.icon;
                const isPending = pendingTool?.label === tool.label;
                return (
                  <button
                    key={tool.label}
                    className={`${styles.toolBtn} ${isPending ? styles.toolBtnActive : ''}`}
                    onClick={() => setPendingTool(isPending ? null : tool)}
                    title={tool.label}
                    disabled={!canEdit}
                    aria-label={tool.label}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>

            <div className={styles.toolDivider} />

            <div className={styles.toolbarGroup}>
              {NODE_TOOLS.slice(2).map(tool => {
                const Icon = tool.icon;
                const isPending = pendingTool?.label === tool.label;
                return (
                  <button
                    key={tool.label}
                    className={`${styles.toolBtn} ${isPending ? styles.toolBtnActive : ''}`}
                    onClick={() => setPendingTool(isPending ? null : tool)}
                    title={tool.label}
                    disabled={!canEdit}
                    aria-label={tool.label}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>

            <div className={styles.toolDivider} />

            <div className={styles.toolbarGroup}>
              <button
                className={styles.toolBtn}
                onClick={() => imageInputRef.current?.click()}
                disabled={!canEdit}
                title="Insert Image (JPG/PNG)"
                aria-label="Insert Image"
              >
                <ImageIcon size={18} />
              </button>
            </div>

            <div className={styles.toolDivider} />

            <div className={styles.toolbarGroup}>
              <button
                className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
                onClick={deleteSelected}
                disabled={!canEdit || (!selectedId && selectedEdgeIds.length === 0)}
                title="Delete selected (Del)"
                aria-label="Delete selected"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Floating properties panel */}
        {canEdit && floatPos && panelVisible && selectedNode?.type !== 'image' && (
          <div
            className={styles.floatPanel}
            style={{ left: floatPos.x - 30, top: floatPos.y, transform: 'translateX(-100%)' }}
          >
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className={styles.floatPanelLabel}>
                {selectedEdge && !selectedNode ? 'Connector' : 'Properties'}
              </span>
              <button
                onClick={() => setPanelVisible(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 2, borderRadius: 4 }}
              ><X size={14} /></button>
            </div>

              {/* ── Edge panel ── */}
              {selectedEdge && !selectedNode && (
                <>
                  <div className={styles.floatBtnRow}>
                    {[['Solid','solid'],['Dash','dash'],['Dots','dots']].map(([lbl, key]) => (
                      <button
                        key={key}
                        className={`${styles.floatBtn} ${getLineStyleKey(selectedEdge) === key ? styles.floatBtnActive : ''}`}
                        onClick={() => updateEdgeLineStyle(key)}
                      >{lbl}</button>
                    ))}
                  </div>
                  <div className={styles.floatBtnRow} style={{ alignItems: 'center', gap: 6 }}>
                    <span className={styles.floatPanelLabel} style={{ marginBottom: 0, flexShrink: 0 }}>Start</span>
                    <select className={styles.propInput} value={getMarkerType(selectedEdge.markerStart)} onChange={e => updateEdgeMarker('start', e.target.value)}>
                      <option value="none">None</option>
                      <option value="arrow">Arrow</option>
                    </select>
                    <span className={styles.floatPanelLabel} style={{ marginBottom: 0, flexShrink: 0 }}>End</span>
                    <select className={styles.propInput} value={getMarkerType(selectedEdge.markerEnd)} onChange={e => updateEdgeMarker('end', e.target.value)}>
                      <option value="none">None</option>
                      <option value="arrow">Arrow</option>
                    </select>
                  </div>
                </>
              )}

              {/* ── Node panel ── */}
              {selectedNode && (
                <>
                  {/* Label */}
                  {selectedNode.type !== 'image' && (
                    <input
                      className={styles.propInput}
                      value={selectedNode.data.label || ''}
                      placeholder="Label…"
                      onChange={e => updateLabel(e.target.value)}
                    />
                  )}

                  {/* Arrow flip controls */}
                  {selectedNode.data?.shape === 'arrow' && (
                    <>
                      <span className={styles.floatPanelLabel}>Flip</span>
                      <div className={styles.floatBtnRow}>
                        {[['left', ArrowBigLeft], ['right', ArrowBigRight], ['up', ArrowBigUp], ['down', ArrowBigDown]].map(([dir, Icon]) => (
                          <button
                            key={dir}
                            className={`${styles.floatBtn} ${(selectedNode.data.arrowDir || 'right') === dir ? styles.floatBtnActive : ''}`}
                            style={{ flex: '0 0 32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => updateTextProp('arrowDir', dir)}
                            title={`Arrow ${dir}`}
                          >
                            <Icon size={14} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Text node controls */}
                  {selectedNode.type === 'text' && (
                    <>
                      <div className={styles.floatBtnRow}>
                        <select
                          className={styles.propInput}
                          style={{ flex: 1 }}
                          value={selectedNode.data.fontSize || 16}
                          onChange={e => updateTextProp('fontSize', Number(e.target.value))}
                        >
                          {[10,11,12,13,14,16,18,20,22,24,28,32,36,40,48,56,60].map(s => (
                            <option key={s} value={s}>{s}px</option>
                          ))}
                        </select>
                        {[['B', 'fontWeight', [400,700]], ['I', 'fontStyle', ['normal','italic']]].map(([lbl, key, [off, on]]) => (
                          <button
                            key={lbl}
                            className={`${styles.floatBtn} ${selectedNode.data[key] === on ? styles.floatBtnActive : ''}`}
                            style={{ flex: '0 0 32px', fontWeight: lbl === 'B' ? 700 : 400, fontStyle: lbl === 'I' ? 'italic' : 'normal' }}
                            onClick={() => updateTextProp(key, selectedNode.data[key] === on ? off : on)}
                          >{lbl}</button>
                        ))}
                        {[[AlignLeft,'left'],[AlignCenter,'center'],[AlignRight,'right']].map(([Icon, val]) => (
                          <button
                            key={val}
                            className={`${styles.floatBtn} ${(selectedNode.data.align || 'left') === val ? styles.floatBtnActive : ''}`}
                            style={{ flex: '0 0 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => updateTextProp('align', val)}
                          ><Icon size={13} /></button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Font color — sticky uses limited palette, other shapes use full palette */}
                  {selectedNode.type !== 'image' && <span className={styles.floatPanelLabel}>Font Color</span>}
                  {selectedNode.type !== 'image' && (
                    <div className={styles.colorGrid}>
                      {(selectedNode.data.shape === 'sticky'
                        ? ['#222831','#ffffff','#468432','#ef4444']
                        : COLORS
                      ).map(c => (
                        <button key={c}
                          className={`${styles.colorDot} ${(selectedNode.data.fontColor || (selectedNode.data.shape === 'sticky' ? '#222831' : '#ffffff')) === c ? styles.colorDotActive : ''}`}
                          style={{ background: c, border: c === '#ffffff' ? '1.5px solid var(--border-color)' : undefined }}
                          onClick={() => updateTextProp('fontColor', c)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Shape fill */}
                  {selectedNode.type !== 'text' && selectedNode.type !== 'image' && (
                    <>
                      <span className={styles.floatPanelLabel}>Fill</span>
                      <div className={styles.colorGrid}>
                        <button
                          className={`${styles.colorDot} ${selectedNode.data.color === 'transparent' ? styles.colorDotActive : ''}`}
                          style={{ background: 'repeating-conic-gradient(#ccc 0% 25%,#fff 0% 50%) 0 0/8px 8px', border: '1.5px solid var(--border-color)' }}
                          title="Transparent" onClick={() => updateColor('transparent')}
                        />
                        {(selectedNode.data.shape === 'sticky' ? STICKY_COLORS : COLORS).map(c => (
                          <button key={c}
                            className={`${styles.colorDot} ${selectedNode.data.color === c ? styles.colorDotActive : ''}`}
                            style={{ background: c, border: c === '#ffffff' ? '1.5px solid var(--border-color)' : undefined }}
                            onClick={() => updateColor(c)}
                          />
                        ))}
                      </div>

                      {/* Border */}
                      <span className={styles.floatPanelLabel}>Border</span>
                      <div className={styles.floatBtnRow}>
                        {[0,1,2,3,4].map(w => (
                          <button key={w}
                            className={`${styles.floatBtn} ${(selectedNode.data.borderWidth || 0) === w ? styles.floatBtnActive : ''}`}
                            style={{ fontSize: '0.7rem' }}
                            onClick={() => updateTextProp('borderWidth', w)}
                          >{w === 0 ? '—' : `${w}px`}</button>
                        ))}
                      </div>

                      {(selectedNode.data.borderWidth || 0) > 0 && (
                        <>
                          <div className={styles.floatBtnRow}>
                            {[['Solid','solid'],['Dash','dash'],['Dots','dots']].map(([lbl, key]) => (
                              <button key={key}
                                className={`${styles.floatBtn} ${styles.floatIconBtn} ${(selectedNode.data.borderStyle || 'solid') === key ? styles.floatBtnActive : ''}`}
                                onClick={() => updateTextProp('borderStyle', key)}
                                title={lbl}
                                aria-label={lbl}
                              >
                                <span
                                  className={`${styles.lineStyleIcon} ${
                                    key === 'solid' ? styles.lineStyleSolid :
                                    key === 'dash' ? styles.lineStyleDash :
                                    styles.lineStyleDots
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                          <div className={styles.colorGrid}>
                            {['#000000',...COLORS].map(c => (
                              <button key={c}
                                className={`${styles.colorDot} ${(selectedNode.data.borderColor || '#000000') === c ? styles.colorDotActive : ''}`}
                                style={{ background: c }} onClick={() => updateTextProp('borderColor', c)}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}

                </>
              )}
          </div>
        )}

        {/* Saving in progress prompt */}
        {showSavingPrompt && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 500,
          }}>
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 12,
              padding: '28px 32px', width: 340,
              boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>
                Menyimpan…
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Flow sedang disimpan. Tunggu sebentar atau keluar tanpa menyimpan.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <button
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                    background: 'var(--color-primary)', color: '#fff',
                    fontWeight: 600, fontSize: '0.875rem', cursor: 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                  onClick={() => { pendingBackRef.current = true; }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff',
                    display: 'inline-block',
                    animation: 'dustflow-spin 0.7s linear infinite',
                  }} />
                  Tunggu Selesai…
                </button>
                <button
                  onClick={() => { setShowSavingPrompt(false); onBack(); }}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 8,
                    border: '1px solid var(--border-color)', background: 'transparent',
                    color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer',
                  }}
                >Keluar Tanpa Menyimpan</button>
                <button
                  onClick={() => setShowSavingPrompt(false)}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 8,
                    border: '1px solid var(--border-color)', background: 'transparent',
                    color: 'var(--text-main)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                  }}
                >Batal</button>
              </div>
            </div>
          </div>
        )}

        {/* Unsaved changes exit prompt */}
        {showExitPrompt && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 500,
          }}>
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 12,
              padding: '28px 32px', width: 340,
              boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>
                Unsaved Changes
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                You have unsaved changes. Do you want to save before leaving?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <button
                  onClick={async () => { setShowExitPrompt(false); await handleSave(); onBack(); }}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                    background: 'var(--color-primary)', color: '#fff',
                    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                  }}
                >Save & Exit</button>
                <button
                  onClick={() => { setShowExitPrompt(false); onBack(); }}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 8,
                    border: '1px solid var(--border-color)', background: 'transparent',
                    color: 'var(--text-main)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                  }}
                >Discard & Exit</button>
                <button
                  onClick={() => setShowExitPrompt(false)}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 8,
                    border: '1px solid var(--border-color)', background: 'transparent',
                    color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer',
                  }}
                >Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EditCtx.Provider>
  );
};

/* ── Wrapper with Provider ── */
const FlowEditor = ({ flowId, onBack }) => {
  const { flows, users, loadFlowData, saveFlowData, updateFlow, canEditFlow } = useData();
  const [flowData, setFlowData] = useState(null);
  const meta = flows.find(f => f.id === flowId);
  const canEdit = canEditFlow(meta);
  const ownerUser = users.find(user => user.id === meta?.owner_id) || null;

  useEffect(() => {
    loadFlowData(flowId).then(data => setFlowData(data || { nodes: [], edges: [] }));
  }, [flowId]);

  const handleSave = async (id, name, data) => {
    await saveFlowData(id, data);
    if (name !== meta?.name) await updateFlow(id, { name });
  };

  if (!flowData || !meta) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <ReactFlowProvider>
      <EditorInner
        flowId={flowId}
        flowName={meta.name}
        initialVisibility={meta.visibility || 'public'}
        initialEditorIds={Array.isArray(meta.editor_ids) ? meta.editor_ids : []}
        ownerUser={ownerUser}
        initialData={flowData}
        onBack={onBack}
        onSave={handleSave}
        onVisibilityChange={(id, visibility) => updateFlow(id, { visibility })}
        onEditorsChange={(id, editor_ids) => updateFlow(id, { editor_ids })}
        canEdit={canEdit}
      />
    </ReactFlowProvider>
  );
};

export default FlowEditor;
