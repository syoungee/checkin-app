// src/pages/CalendarPage.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import { db } from './firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import EventList from './components/EventList';
import './CalendarPage.css';

function ymd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function monthRange(date) {
  // date는 현재 보이는 달의 아무 날
  const y = date.getFullYear();
  const m = date.getMonth(); // 0~11
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0); // 말일
  return { start: ymd(start), end: ymd(end) };
}

function CalendarPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeMonthDate, setActiveMonthDate] = useState(new Date()); // 달 전환 감지용
  const [events, setEvents] = useState([]); // 현재 달의 일정 전체
  const [loading, setLoading] = useState(false);

  // 월 범위 로드
  const loadEventsForMonth = useCallback(async (baseDate) => {
    setLoading(true);
    try {
      const { start, end } = monthRange(baseDate);
      // date 필드가 "YYYY-MM-DD"로 저장되어 있으므로 문자열 범위로 월 단위 조회 가능
      const q = query(collection(db, 'events'), where('date', '>=', start), where('date', '<=', end), orderBy('date'), orderBy('time'));
      const snap = await getDocs(q);
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

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleActiveStartDateChange = ({ activeStartDate, view }) => {
    // view === 'month' 일 때 월이 바뀜
    if (view === 'month' && activeStartDate) {
      setActiveMonthDate(activeStartDate);
    }
  };

  // 날짜별로 묶기
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of events) {
      const key = ev.date; // 'YYYY-MM-DD'
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  // 선택 날짜의 일정
  const selectedKey = ymd(selectedDate);
  const selectedEvents = eventsByDate[selectedKey] || [];

  // 플로팅 버튼으로 생성 페이지 이동
  const goCreate = () => {
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    navigate('/create-event', { state: { date: `${yyyy}-${mm}-${dd}` } });
  };

  return (
    <div className="calendar-container">
      <h2 style={{ textAlign: 'center' }}>📅 일정 캘린더</h2>

      <Calendar
        onChange={handleDateChange}
        value={selectedDate}
        calendarType="gregory"
        locale="ko-KR"
        onActiveStartDateChange={handleActiveStartDateChange}
        // 각 날짜 칸에 점/카운트
        tileContent={({ date, view }) => {
          if (view !== 'month') return null;
          const key = ymd(date);
          const cnt = eventsByDate[key]?.length || 0;
          if (!cnt) return null;
          return (
            <div className="cal-dot-wrap">
              <span className="cal-dot" title={`${cnt}개의 일정`} />
            </div>
          );
        }}
        // 선택/오늘/일정있는날 스타일 보완: 필요 시 tileClassName 활용
        tileClassName={({ date, view }) => {
          if (view !== 'month') return '';
          const key = ymd(date);
          if (eventsByDate[key]?.length) return 'has-events';
          return '';
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

      <EventList events={selectedEvents} emptyText="선택한 날짜에 일정이 없습니다." />

      <h3 style={{ marginTop: 24 }}>이번 달 전체 일정</h3>
      <EventList events={events} emptyText="이번 달 일정이 없습니다." />
    </div>
  );
}

export default CalendarPage;
