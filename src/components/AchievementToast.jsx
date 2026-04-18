import { useEffect } from 'react';
import './AchievementToast.css';

export default function AchievementToast({ achievement, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="achievement-toast" onClick={onDismiss}>
      <span className="toast-icon">{achievement.icon}</span>
      <div className="toast-text">
        <span className="toast-title">Yeni Rozet!</span>
        <span className="toast-name">{achievement.label}</span>
      </div>
    </div>
  );
}
