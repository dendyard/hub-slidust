import { useState } from 'react';
import { Sparkles, X, Send, RefreshCw, CheckSquare, User, ChevronRight } from 'lucide-react';
import { useData } from '../../context/DataContext';
import UserAvatar from '../ui/UserAvatar';
import styles from './AIWizardModal.module.css';
import BASE_PROMPT_RAW from '../../prompts/task-prd-prompt.md?raw';
import mascot from '../../assets/magic-ai.png';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) throw new Error('VITE_OPENAI_API_KEY tidak ditemukan. Restart Vite dev server.');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `OpenAI error ${res.status}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export default function AIWizardModal({ onClose, onConfirm, initialStatus }) {
  const { projectMembers, users } = useData();

  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);

  /* members of current project */
  const members = projectMembers
    .map(pm => users.find(u => u.id === pm.user_id))
    .filter(Boolean);

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const memberList = members.map(u => `- id:${u.id} name:${u.name} role:${u.role ?? ''}`).join('\n');
      const prompt = `${BASE_PROMPT_RAW}

---

## Team Members Available
${memberList || '(none)'}

## Brief Task Description
"${input.trim()}"`;

      const data = await callOpenAI(prompt);
      setResult({
        title:            data.title            || '',
        description:      data.description      || '',
        subtasks:         (data.subtasks        || []).map(t => ({ id: `s_${Math.random().toString(36).slice(2, 10)}`, title: t, isDone: 0 })),
        mentionedUserIds: data.mentionedUserIds  || [],
      });
    } catch (e) {
      setError(`Error: ${e.message || 'Gagal menghubungi OpenAI. Cek API key atau koneksi.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!result) return;
    const mentionStr = result.mentionedUserIds
      .map(id => {
        const u = members.find(m => m.id === id);
        return u ? `@${u.name}` : '';
      })
      .filter(Boolean)
      .join(' ');

    const descWithMentions = mentionStr
      ? `${result.description}<p>${mentionStr}</p>`
      : result.description;

    onConfirm({
      title:       result.title,
      description: descWithMentions,
      subtasks:    result.subtasks,
      status:      initialStatus || null,
    });
  };

  const mentionedMembers = result?.mentionedUserIds
    ?.map(id => members.find(m => m.id === id))
    .filter(Boolean) || [];

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <img src={mascot} alt="" className={styles.headerMascot} />
          <div className={styles.headerContent}>
            <div className={styles.headerTitle}>
              AI Task Wizard
            </div>
            <div className={styles.headerSub}>Describe the task, AI will expand the details</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        {/* Input */}
        <div className={styles.body}>

          {/* Input — only shown before result */}
          {!result && !loading && (
            <div className={styles.inputSection}>
              <label className={styles.inputLabel}>Brief task description</label>
              <div className={styles.inputRow}>
                <textarea
                  className={styles.inputArea}
                  placeholder="Example: Build a landing page for the Ramadan campaign, need design and copywriting..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
                  }}
                  rows={4}
                  disabled={loading}
                />
                <button
                  className={styles.generateBtn}
                  onClick={handleGenerate}
                  disabled={loading || !input.trim()}
                  title="Generate (Cmd+Enter)"
                >
                  <Send size={16} />
                </button>
              </div>
              {error && <div className={styles.errorMsg}>{error}</div>}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className={styles.loadingCard}>
              <div className={styles.loadingDots}>
                <span /><span /><span />
              </div>
              <p>AI is analyzing and developing the task...</p>
            </div>
          )}

          {/* Result preview */}
          {result && !loading && (
            <>
              <div className={styles.resultSection}>
                <div className={styles.resultHeader}>
                  <Sparkles size={13} />
                  <span>AI Result — review before creating the task</span>
                </div>

                {/* Title */}
                <div className={styles.resultBlock}>
                  <div className={styles.resultBlockLabel}>Task Title</div>
                  <input
                    className={styles.resultTitle}
                    value={result.title}
                    onChange={e => setResult(r => ({ ...r, title: e.target.value }))}
                  />
                </div>

                {/* Description */}
                <div className={styles.resultBlock}>
                  <div className={styles.resultBlockLabel}>Description</div>
                  <div
                    className={styles.resultDesc}
                    dangerouslySetInnerHTML={{ __html: result.description }}
                  />
                </div>

                {/* Subtasks */}
                {result.subtasks.length > 0 && (
                  <div className={styles.resultBlock}>
                    <div className={styles.resultBlockLabel}>
                      <CheckSquare size={12} /> Subtasks ({result.subtasks.length})
                    </div>
                    <div className={styles.subtaskList}>
                      {result.subtasks.map((s, i) => (
                        <div key={s.id} className={styles.subtaskItem}>
                          <span className={styles.subtaskDot} />
                          <input
                            className={styles.subtaskInput}
                            value={s.title}
                            onChange={e => setResult(r => ({
                              ...r,
                              subtasks: r.subtasks.map((x, j) =>
                                j === i ? { ...x, title: e.target.value } : x
                              ),
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mentions */}
                {mentionedMembers.length > 0 && (
                  <div className={styles.resultBlock}>
                    <div className={styles.resultBlockLabel}>
                      <User size={12} /> Suggested team members
                    </div>
                    <div className={styles.mentionList}>
                      {mentionedMembers.map(u => (
                        <div key={u.id} className={styles.mentionChip}>
                          <UserAvatar user={u} size={20} />
                          <span>{u.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Brief summary below result */}
              <div className={styles.briefSummary}>
                <span className={styles.briefSummaryLabel}>Your brief:</span>
                {input}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          {result && !loading && (
            <>
              <button className={styles.regenBtn} onClick={handleGenerate}>
                <RefreshCw size={13} /> Regenerate
              </button>
              <button className={styles.confirmBtn} onClick={handleConfirm}>
                <ChevronRight size={15} /> Create Task
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
