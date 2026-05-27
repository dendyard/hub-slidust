import { useState, useRef } from 'react';
import UserAvatar from './UserAvatar';
import styles from './MentionTextarea.module.css';

// "John Doe" → "John_Doe"  (used as the stored @handle)
export const nameToHandle = (name) => name.replace(/\s+/g, '_');

// Parse all @handles out of a message string
export const extractMentionHandles = (text) => {
  const matches = text.match(/@[\w]+/g) || [];
  return [...new Set(matches.map(m => m.slice(1)))];
};

const MentionTextarea = ({ value, onChange, onSend, disabled, placeholder, users, className, autoFocus }) => {
  const [mentionQuery, setMentionQuery] = useState(null); // null = not in mention mode
  const [mentionStart, setMentionStart] = useState(-1);   // index of '@' in value
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef(null);

  const filteredUsers = mentionQuery !== null
    ? users.filter(u => {
        const q = mentionQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          nameToHandle(u.name).toLowerCase().includes(q)
        );
      }).slice(0, 6)
    : [];

  const handleChange = (e) => {
    const val    = e.target.value;
    const cursor = e.target.selectionStart;
    onChange(val);

    // Detect @query: '@' preceded by start-of-string or whitespace, followed by \w*
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/(^|[\s\n])@(\w*)$/);
    if (match) {
      setMentionQuery(match[2]);
      setMentionStart(cursor - match[2].length - 1); // position of '@'
      setActiveIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (user) => {
    const handle     = nameToHandle(user.name);
    const cursor     = textareaRef.current.selectionStart;
    const before     = value.slice(0, mentionStart);
    const after      = value.slice(cursor);
    const newVal     = `${before}@${handle} ${after}`;
    onChange(newVal);
    setMentionQuery(null);

    setTimeout(() => {
      const pos = mentionStart + handle.length + 2; // after "@handle "
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleKeyDown = (e) => {
    // Mention dropdown navigation
    if (mentionQuery !== null && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => (i + 1) % filteredUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => (i - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    // Normal Enter → send
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className={styles.wrapper}>
      <textarea
        ref={textareaRef}
        className={className}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {mentionQuery !== null && filteredUsers.length > 0 && (
        <div className={styles.dropdown}>
          {filteredUsers.map((u, i) => (
            <div
              key={u.id}
              className={`${styles.item} ${i === activeIndex ? styles.itemActive : ''}`}
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <UserAvatar user={u} size={22} />
              <span className={styles.itemName}>{u.name}</span>
              <span className={styles.itemHandle}>@{nameToHandle(u.name)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionTextarea;
