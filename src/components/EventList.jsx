import React from 'react';
import './EventList.css';

function parseYMD(ymd) {
  // 'YYYY-MM-DD' → Date
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatMonthKR(date) {
  if (!date) return '';
  return `${date.getMonth() + 1}월`;
}

function formatDay(date) {
  if (!date) return '';
  return String(date.getDate()).padStart(2, '0');
}

function weekdayKR(date) {
  if (!date) return '';
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
}

export default function EventList({ events = [], emptyText = '일정이 없습니다.' }) {
  if (!events.length) return <div className="ev-empty">{emptyText}</div>;

  return (
    <ul className="ev-list">
      {events.map((ev) => {
        const d = parseYMD(ev.date);
        return (
          <li key={ev.id} className="ev-item">
            {/* 날짜 배지 */}
            <div className="ev-datebox" aria-hidden>
              <div className="ev-month">{formatMonthKR(d)}</div>
              <div className="ev-day">{formatDay(d)}</div>
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
                <span className="chip light">{weekdayKR(d)}요일</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
