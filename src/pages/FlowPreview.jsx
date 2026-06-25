import { useEffect, useState } from 'react';
import { ReactFlow, Background, Controls, ReactFlowProvider, ConnectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Check, Link2 } from 'lucide-react';
import { nodeTypes } from '../components/drawflow/FlowEditor.jsx';
import goalLogo from '../assets/goallogo.png';
import styles from './FlowPreview.module.css';

const API_BASE = import.meta.env.VITE_API_BASE;

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
};

const FlowPreview = ({ flowId }) => {
  const [flow, setFlow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); }
    catch { window.prompt('Copy link', url); }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1400);
  };

  useEffect(() => {
    fetch(`${API_BASE}/flows/public?id=${encodeURIComponent(flowId)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { setFlow(data); setLoading(false); })
      .catch(err => { setError(err === 404 ? 'not_found' : 'error'); setLoading(false); });
  }, [flowId]);

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
        <p className={styles.errorTitle}>Flow not found</p>
        <p className={styles.errorSub}>This flow may be private or does not exist.</p>
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

  const data = flow.flow_data || {};
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  const viewport = data.viewport || { x: 0, y: 0, zoom: 1 };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.topBarLeft}>
            <img src={goalLogo} alt="Slidust" className={styles.logo} />
            <span className={styles.flowName}>{flow.name || 'Untitled Flow'}</span>
          </div>
          <div className={styles.topBarRight}>
            <div className={styles.authorMeta}>
              <span className={styles.authorName}>{flow.owner_name || 'Unknown'}</span>
              {flow.updated_at && (
                <span className={styles.lastUpdate}>Updated {formatDate(flow.updated_at)}</span>
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

      <div className={styles.canvas}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{ style: { strokeWidth: 1, stroke: '#000000' }, markerEnd: { type: 'arrowclosed', color: '#000000' } }}
            defaultViewport={viewport}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={4}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            edgesFocusable={false}
            nodesFocusable={false}
            panOnDrag
            zoomOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background variant="cross" gap={40} size={1} color="transparent" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default FlowPreview;
