// src/pages/CalendarPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import { db } from './firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import EventList from './components/EventList';
import './CalendarPage.css';

/** YYYY-MM-DD */
function ymd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function monthRange(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start: ymd(start), end: ymd(end) };
}

/** 장소 라벨 (캘린더 타일 뱃지 텍스트) */
function labelOf(ev) {
  const txt = (ev.location || '').trim();
  return txt || '일정';
}

/** 모바일 미디어쿼리 훅 */
function useMedia(query) {
  const getMatch = () => (window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = React.useState(getMatch);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener ? mql.addEventListener('change', onChange) : mql.addListener(onChange);
    return () => {
      mql.removeEventListener ? mql.removeEventListener('change', onChange) : mql.removeListener(onChange);
    };
  }, [query]);
  return matches;
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const isMobile = useMedia('(max-width: 480px)');

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeMonthDate, setActiveMonthDate] = useState(new Date()); // 상단 타이틀/로딩 기준
  const [events, setEvents] = useState([]); // 현재 달 전체 일정
  const [loading, setLoading] = useState(false);

  // 월 단위 로드
  const loadEventsForMonth = useCallback(async (baseDate) => {
    setLoading(true);
    try {
      const { start, end } = monthRange(baseDate);
      // date: 'YYYY-MM-DD' 문자열 범위 쿼리
      const qy = query(collection(db, 'events'), where('date', '>=', start), where('date', '<=', end), orderBy('date'), orderBy('time'));
      const snap = await getDocs(qy);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEvents(list);
    } catch (e) {
      console.error('이벤트 로드 실패', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEventsForMonth(activeMonthDate);
  }, [activeMonthDate, loadEventsForMonth]);

  // 날짜별 그룹핑
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of events) {
      const key = ev.date;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  // 네비게이션(상단 좌/우)
  const goPrevMonth = () => {
    setActiveMonthDate(new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    setActiveMonthDate(new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() + 1, 1));
  };

  const selectedKey = ymd(selectedDate);
  const selectedEvents = eventsByDate[selectedKey] || [];

  // 일정 생성 이동
  const goCreate = () => {
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    navigate('/create-event', { state: { date: `${yyyy}-${mm}-${dd}` } });
  };

  return (
    <div className="calendar-container ios">
      {/* iOS 스타일 상단 헤더 (한 줄, 크게) */}
      <div className="cal-header oneline">
        <button type="button" className="cal-nav" aria-label="이전 달" onClick={goPrevMonth}>
          ‹
        </button>
        <div className="cal-title">
          {activeMonthDate.getFullYear()}년 {String(activeMonthDate.getMonth() + 1)}월
        </div>
        <button type="button" className="cal-nav" aria-label="다음 달" onClick={goNextMonth}>
          ›
        </button>
      </div>

      <Calendar
        onChange={setSelectedDate}
        value={selectedDate}
        calendarType="gregory"
        locale="ko-KR"
        onActiveStartDateChange={({ activeStartDate, view }) => {
          if (view === 'month' && activeStartDate) setActiveMonthDate(activeStartDate);
        }}
        formatShortWeekday={(l, d) => ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}
        /* 모바일에선 '일' 접미사 없이 숫자만 */
        formatDay={(locale, date) => (isMobile ? String(date.getDate()) : new Intl.DateTimeFormat('ko-KR', { day: 'numeric' }).format(date))}
        nextLabel={null}
        prevLabel={null}
        next2Label={null}
        prev2Label={null}
        // 날짜 칸 아래 iOS 뱃지들
        tileContent={({ date, view }) => {
          if (view !== 'month') return null;
          const key = ymd(date);
          const dayEvents = eventsByDate[key] || [];
          if (!dayEvents.length) return null;

          const shown = dayEvents.slice(0, 3);
          const more = dayEvents.length - shown.length;

          return (
            <div className="ios-badges">
              {shown.map((ev) => (
                <span key={ev.id} className="ios-badge" title={labelOf(ev)}>
                  {labelOf(ev)}
                </span>
              ))}
              {more > 0 && <span className="ios-badge more">+{more}</span>}
            </div>
          );
        }}
        tileClassName={({ date, view }) => {
          if (view !== 'month') return '';
          const key = ymd(date);
          return eventsByDate[key]?.length ? 'has-events' : '';
        }}
      />

      <div className="sel-header">
        <h3>
          {selectedKey} 일정 {loading ? '(불러오는 중...)' : ''}
        </h3>
        <button className="mini-btn" onClick={goCreate}>
          + 일정 등록
        </button>
      </div>

      <EventList events={selectedEvents} emptyText="선택한 날짜에 일정이 없습니다." onItemClick={(ev) => navigate(`/event/${ev.id}`)} />

      <h3 style={{ marginTop: 24 }}>이번 달 전체 일정</h3>
      <EventList events={events} emptyText="이번 달 일정이 없습니다." onItemClick={(ev) => navigate(`/event/${ev.id}`)} />
    </div>
  );
}
