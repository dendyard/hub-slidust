import { useState, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, GitBranch, Trash2, Clock } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import styles from './FlowList.module.css';

const formatDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const PAD = 16;

const FlowPreview = ({ flowId, updatedAt }) => {
  const { loadFlowData } = useData();
  const [flowData, setFlowData] = useState(null);
  const cache = useRef({});

  useEffect(() => {
    const key = `${flowId}_${updatedAt}`;
    if (cache.current[key]) {
      setFlowData(cache.current[key]);
      return;
    }
    loadFlowData(flowId).then(data => {
      cache.current[key] = data;
      setFlowData(data);
    });
  }, [flowId, updatedAt]);

  const nodes = flowData?.nodes ?? null;
  const edges = flowData?.edges ?? [];

  if (!nodes || nodes.length === 0) {
    return <GitBranch size={32} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />;
  }

  const xs = nodes.map(n => n.position.x);
  const ys = nodes.map(n => n.position.y);
  const rights = nodes.map(n => n.position.x + (n.width || 140));
  const bottoms = nodes.map(n => n.position.y + (n.height || 60));

  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const maxX = Math.max(...rights) + PAD;
  const maxY = Math.max(...bottoms) + PAD;
  const vW = maxX - minX;
  const vH = maxY - minY;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`${minX} ${minY} ${vW} ${vH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      {edges.map(edge => {
        const src = nodes.find(n => n.id === edge.source);
        const tgt = nodes.find(n => n.id === edge.target);
        if (!src || !tgt) return null;
        const x1 = src.position.x + (src.width || 140) / 2;
        const y1 = src.position.y + (src.height || 60) / 2;
        const x2 = tgt.position.x + (tgt.width || 140) / 2;
        const y2 = tgt.position.y + (tgt.height || 60) / 2;
        const da = edge.style?.strokeDasharray;
        return (
          <line
            key={edge.id}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#94a3b8"
            strokeWidth="3"
            strokeDasharray={da ?? undefined}
          />
        );
      })}

      {nodes.map(node => {
        const w = node.width || 140;
        const h = node.height || 60;
        const x = node.position.x;
        const y = node.position.y;
        const color = node.data?.color || '#3b82f6';
        const shape = node.data?.shape;

        if (shape === 'diamond') {
          const cx = x + w / 2, cy = y + h / 2;
          return (
            <polygon key={node.id} points={`${cx},${y} ${x+w},${cy} ${cx},${y+h} ${x},${cy}`} fill={color} opacity="0.85" />
          );
        }
        if (shape === 'rounded') {
          return <rect key={node.id} x={x} y={y} width={w} height={h} rx={h / 2} fill={color} opacity="0.85" />;
        }
        if (shape === 'step') {
          const cx = x + w, cy = y + h / 2;
          return (
            <polygon key={node.id} points={`${x},${y} ${x+w*0.8},${y} ${x+w},${cy} ${x+w*0.8},${y+h} ${x},${y+h}`} fill={color} opacity="0.85" />
          );
        }
        if (shape === 'io') {
          return (
            <polygon key={node.id} points={`${x+w*0.15},${y} ${x+w},${y} ${x+w*0.85},${y+h} ${x},${y+h}`} fill={color} opacity="0.85" />
          );
        }
        if (shape === 'database') {
          const ry = h * 0.13;
          return (
            <g key={node.id} opacity="0.85">
              <rect x={x} y={y + ry} width={w} height={h - ry * 2} fill={color} />
              <ellipse cx={x + w / 2} cy={y + ry} rx={w / 2} ry={ry} fill={color} />
              <ellipse cx={x + w / 2} cy={y + h - ry} rx={w / 2} ry={ry} fill={color} />
            </g>
          );
        }
        if (shape === 'sticky') {
          const fold = Math.min(w, h) * 0.22;
          return (
            <g key={node.id} opacity="0.85">
              <polygon points={`${x},${y} ${x+w-fold},${y} ${x+w},${y+fold} ${x+w},${y+h} ${x},${y+h}`} fill={color} />
              <polygon points={`${x+w-fold},${y} ${x+w},${y+fold} ${x+w-fold},${y+fold}`} fill="rgba(0,0,0,0.18)" />
            </g>
          );
        }
        if (shape === 'person') {
          return (
            <svg key={node.id} x={x} y={y} width={w} height={h} viewBox="0 0 117 282" preserveAspectRatio="xMidYMid meet">
              <path
                d="M60 73L60 196M59.1213 75.1213L2.12134 132.121M59.1213 70.8787L114.121 125.879M59.7643 197.166L24.7643 280.166M59.7643 194.834L94.7643 277.834M96 38C96 57.33 80.33 73 61 73C41.6701 73 26 57.33 26 38C26 18.67 41.6701 3 61 3C80.33 3 96 18.67 96 38Z"
                stroke={color} strokeWidth="6" fill="none"
              />
            </svg>
          );
        }
        if (node.type === 'text') {
          return (
            <rect key={node.id} x={x} y={y} width={w} height={h} rx={4} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 3" />
          );
        }
        return <rect key={node.id} x={x} y={y} width={w} height={h} rx={6} fill={color} opacity="0.85" />;
      })}
    </svg>
  );
};

const FlowList = ({ onOpenFlow }) => {
  const { flows, createFlow, deleteFlow, currentUser, users } = useData();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const canDelete = (flow) => isAdmin || flow.owner_id === currentUser?.id;
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const flow = await createFlow(name);
    setNewName('');
    setCreating(false);
    if (flow?.id) onOpenFlow(flow.id);
  };

  const handleDelete = (id) => {
    deleteFlow(id);
    setConfirmDelete(null);
  };

  const handleCancelCreate = () => {
    setCreating(false);
    setNewName('');
  };

  return (
    <div className={styles.page}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft} />
        <button className={styles.newBtn} onClick={() => setCreating(true)}>
          <Plus size={15} /> Create New Dust Flow
        </button>
      </div>

      {/* Create modal */}
      {creating && (
        <div className={styles.confirmOverlay} onClick={handleCancelCreate}>
          <div className={styles.createModal} onClick={e => e.stopPropagation()}>
            <p className={styles.createModalTitle}>Create New Dust Flow</p>
            <input
              className={styles.nameInput}
              placeholder="Flow name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') handleCancelCreate(); }}
              autoFocus
            />
            <div className={styles.createActions}>
              <button className={styles.cancelBtn} onClick={handleCancelCreate}>Cancel</button>
              <button className={styles.createBtn} onClick={handleCreate} disabled={!newName.trim()}>
                <Plus size={14} /> Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.content}>
        {flows.length === 0 && !creating ? (
          <div className={styles.empty}>
            <GitBranch size={48} strokeWidth={1.2} />
            <p>No flows yet. Create your first flow!</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {flows.map(f => {
              const owner = users.find(u => u.id === f.owner_id);
              return (
                <div key={f.id} className={styles.card} onClick={() => onOpenFlow(f.id)}>
                  <div className={styles.cardThumb}>
                    <FlowPreview flowId={f.id} updatedAt={f.updated_at} />
                  </div>
                  <div className={styles.cardBody}>
                    <span className={styles.cardName}>{f.name}</span>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardDate}>
                        <Clock size={11} /> {formatDate(f.updated_at || f.created_at)}
                      </span>
                      {owner && <UserAvatar user={owner} size={20} title={owner.name} />}
                    </div>
                  </div>
                  {canDelete(f) && (
                    <button
                      className={styles.deleteBtn}
                      onClick={e => { e.stopPropagation(); setConfirmDelete(f.id); }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <p>Delete this flow?</p>
            <div className={styles.confirmActions}>
              <button className={styles.createBtn} onClick={() => handleDelete(confirmDelete)}>Delete</button>
              <button className={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowList;
