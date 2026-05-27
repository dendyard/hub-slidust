import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { CheckSquare, Paperclip, MessageSquare, Calendar, CheckCircle2 } from 'lucide-react';
import styles from './TaskCard.module.css';
import UserAvatar from '../ui/UserAvatar';

const TaskCard = ({ task, onClick, isGlowing }) => {
  const [isDragging, setIsDragging] = useState(false);
  const { users, workflows } = useData();
  const isDoneStage = workflows.some(w => w.id === task.status && w.type === 'DONE');
  const assignee = users.find(u => u.id === task.assignee);

  const handleDragStart = (e) => {
    e.dataTransfer.setData('taskId', task.id);

    // Create a rotated ghost image clone
    const cardEl = e.currentTarget;
    const rect = cardEl.getBoundingClientRect();

    const ghost = cardEl.cloneNode(true);
    ghost.style.position = 'fixed';
    ghost.style.top = '-9999px';
    ghost.style.left = '-9999px';
    ghost.style.width = rect.width + 'px';
    ghost.style.transform = 'none';
    ghost.style.opacity = '0.95';
    ghost.style.boxShadow = '0 16px 40px rgba(0,0,0,0.3)';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);

    e.dataTransfer.setDragImage(ghost, rect.width / 2, 40);

    // Clean up ghost after drag starts
    setTimeout(() => {
      document.body.removeChild(ghost);
      setIsDragging(true);
    }, 0);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const completedSubtasks = task.subtasks ? task.subtasks.filter(s => s.isDone === 1).length : 0;
  const totalSubtasks = task.subtasks ? task.subtasks.length : 0;

  const dueDateLabel = (() => {
    if (!task.due_date) return null;
    const due = new Date(task.due_date + 'T00:00:00');
    return due.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  })();

  const completedDateLabel = (() => {
    if (!task.completedAt) return null;
    return new Date(task.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  })();

  const dueDateState = (() => {
    if (!task.due_date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date + 'T00:00:00');
    const diff = (due - today) / (1000 * 60 * 60 * 24);
    return diff < 2 ? 'overdue' : 'normal';
  })();

  const isHigh = task.priority.toLowerCase() === 'high';

  return (
    <>
    <div
      className={`${styles.card} ${isDragging ? styles.dragging : ''} ${isGlowing ? styles.glow : ''} ${isHigh ? styles.priorityHigh : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
    >
      <div className={styles.badges}></div>

      <h4 className={styles.title}>{task.title}</h4>

      <div className={styles.footer}>
        <div className={styles.metrics}>
          {totalSubtasks > 0 && (
            <div className={`${styles.metric} ${completedSubtasks === totalSubtasks ? styles.done : ''}`}>
              <CheckSquare size={14} />
              <span>{completedSubtasks}/{totalSubtasks}</span>
            </div>
          )}
          {task.attachmentCount > 0 && (
            <div className={styles.metric}>
              <Paperclip size={14} />
              <span>{task.attachmentCount}</span>
            </div>
          )}
          {task.commentCount > 0 && (
            <div className={styles.metric}>
              <MessageSquare size={14} />
              <span>{task.commentCount}</span>
            </div>
          )}
          {dueDateLabel && !isDoneStage && (
            <span className={`${styles.dueDateText} ${styles[dueDateState]}`}>
              <Calendar size={11} />
              {dueDateLabel}
            </span>
          )}
          {completedDateLabel && (
            <span className={styles.completedDateChip}>
              <CheckCircle2 size={11} />
              {completedDateLabel}
            </span>
          )}
        </div>

        {assignee && (
          <UserAvatar user={assignee} size={24} style={{ boxShadow: 'var(--shadow-sm)' }} title={assignee.name} />
        )}
      </div>
    </div>
    </>
  );
};

export default TaskCard;
