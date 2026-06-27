import { useRef, useState } from 'react';
import TaskCard from './TaskCard';
import { Plus, ArrowRight } from 'lucide-react';
import styles from './Column.module.css';

const Column = ({ stageId, status, stageColor, tasks, onDropTask, onTaskClick, maxTasks, onSeeAll, glowTaskId }) => {
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const columnRef = useRef(null);

  const isDragOver = dragOverIndex !== null;

  const handleDragLeave = (e) => {
    if (columnRef.current && !columnRef.current.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  };

  // Fires when dragging over the empty area below all cards
  const handleListDragOver = (e) => {
    e.preventDefault();
    setDragOverIndex(tasks.length);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const idx = dragOverIndex ?? tasks.length;
    setDragOverIndex(null);
    if (taskId) onDropTask(taskId, idx);
  };

  return (
    <div
      ref={columnRef}
      className={`${styles.column} ${isDragOver ? styles.dragOver : ''}`}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <h3>{status}</h3>
          <span className={styles.taskCount}>{tasks.length}</span>
        </div>
        <button className={styles.addBtn} onClick={() => onTaskClick(null, stageId)}>
          <Plus size={16} />
        </button>
      </div>

      <div
        className={styles.taskList}
        onDragOver={handleListDragOver}
      >
        {(maxTasks ? tasks.slice(0, maxTasks) : tasks).map((task, index) => (
          <div
            key={task.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setDragOverIndex(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
            }}
          >
            {dragOverIndex === index && <div className={styles.insertIndicator} />}
            <TaskCard task={task} onClick={() => onTaskClick(task.id)} isGlowing={task.id === glowTaskId} />
          </div>
        ))}
        {dragOverIndex === tasks.length && <div className={styles.insertIndicator} />}
      </div>

      {onSeeAll && maxTasks && tasks.length > maxTasks && (
        <button className={styles.seeAllBtn} onClick={onSeeAll}>
          +{tasks.length - maxTasks} more · See all in List View <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
};

export default Column;
