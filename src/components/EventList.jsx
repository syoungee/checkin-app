// src/components/EventList.jsx
import React from 'react';
import './EventList.css';

export default function EventList({ events = [], emptyText = '일정이 없습니다.', onItemClick }) {
  if (!events.length) return <div className="ev-empty">{emptyText}</div>;

  return (
    <ul className="ev-list">
      {events.map((ev) => (
        <li
          key={ev.id}
          className={`ev-item ${onItemClick ? 'is-clickable' : ''}`}
          onClick={() => onItemClick?.(ev)}
          role={onItemClick ? 'button' : undefined}
          tabIndex={onItemClick ? 0 : undefined}
          onKeyDown={(e) => {
            if (!onItemClick) return;
            if (e.key === 'Enter' || e.key === ' ') onItemClick(ev);
          }}
        >
          {/* 날짜 배지 */}
          <div className="ev-datebox" aria-hidden>
            <div className="ev-month">{(ev.date || '').slice(5, 7)}월</div>
            <div className="ev-day">{(ev.date || '').slice(8, 10)}</div>
          </div>

          {/* 본문 */}
          <div className="ev-main">
            <div className="ev-top">
              <span className="ev-location" title={ev.location}>
                {ev.location || '(장소 미정)'}
              </span>
              <span className="ev-timepill">{ev.time || '--:--'}</span>
            </div>

            <div className="ev-meta">
              <span className="chip">모임장 {ev.host || '-'}</span>
              <span className="chip ghost">참석 {ev.attendeesNames?.length ?? 0}명</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
