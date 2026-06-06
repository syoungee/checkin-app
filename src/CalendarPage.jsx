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

function labelOf(ev) {
  const txt = (ev.location || '').trim();
  return txt || '일정';
}

// 탈퇴 멤버 판별 (생일 표시에서 제외)
const normalizeStatus = (v) => (v ?? '').toString().trim().toLowerCase();
const WITHDRAWN_SET = new Set(['탈퇴', 'withdrawn', 'inactive', '퇴회'].map(normalizeStatus));
const isWithdrawnMember = (m) => WITHDRAWN_SET.has(normalizeStatus(m?.status));

function useMedia(queryStr) {
  const getMatch = () => (window.matchMedia ? window.matchMedia(queryStr).matches : false);
  const [matches, setMatches] = React.useState(getMatch);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(queryStr);
    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener ? mql.addEventListener('change', onChange) : mql.addListener(onChange);
    return () => {
      mql.removeEventListener ? mql.removeEventListener('change', onChange) : mql.removeListener(onChange);
    };
  }, [queryStr]);
  return matches;
}

const includesCI = (source, needle) => {
  if (!needle) return true;
  const n = needle.toLowerCase().trim();
  if (!n) return true;
  if (Array.isArray(source))
    return source.some((x) =>
      String(x ?? '')
        .toLowerCase()
        .includes(n)
    );
  return String(source ?? '')
    .toLowerCase()
    .includes(n);
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const isMobile = useMedia('(max-width: 480px)');

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeMonthDate, setActiveMonthDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔎 검색 필터 (단일 날짜)
  const [qLeader, setQLeader] = useState('');
  const [qMember, setQMember] = useState('');
  const [qLocation, setQLocation] = useState('');
  const [qDate, setQDate] = useState(''); // YYYY-MM-DD

  // 월 단위 로드
  const loadEventsForMonth = useCallback(async (baseDate) => {
    setLoading(true);
    try {
      const { start, end } = monthRange(baseDate);
      const qy = query(collection(db, 'events'), where('date', '>=', start), where('date', '<=', end), orderBy('date'), orderBy('time'));
      const snap = await getDocs(qy);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEvents(list);
      setQDate(''); // 달 바뀌면 날짜 필터 초기화
    } catch (e) {
      console.error('이벤트 로드 실패', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEventsForMonth(activeMonthDate);
  }, [activeMonthDate, loadEventsForMonth]);

  // 멤버 1회 로드 (생일 표시용)
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'members'));
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('멤버 로드 실패', e);
      }
    })();
  }, []);

  // 날짜별 그룹핑
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of events) (map[ev.date] ||= []).push(ev);
    return map;
  }, [events]);

  // 생일 맵: 'MM-DD' -> [이름...] (연도 무관, 탈퇴자 제외)
  const birthdaysByMD = useMemo(() => {
    const map = {};
    for (const m of members) {
      if (isWithdrawnMember(m)) continue;
      const md = (m.birthdate || '').slice(5, 10); // 'YYYY-MM-DD' -> 'MM-DD'
      if (!/^\d{2}-\d{2}$/.test(md)) continue;
      (map[md] ||= []).push(m.name || '이름없음');
    }
    return map;
  }, [members]);

  // 달 이동
  const goPrevMonth = () => setActiveMonthDate(new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() - 1, 1));
  const goNextMonth = () => setActiveMonthDate(new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth() + 1, 1));

  const selectedKey = ymd(selectedDate);

  const goCreate = () => {
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    navigate('/create-event', { state: { date: `${yyyy}-${mm}-${dd}` } });
  };

  // ✅ 월 전체에서 필터 적용
  const filteredMonthEvents = useMemo(() => {
    return events.filter((ev) => {
      if (qDate && ev.date !== qDate) return false; // 날짜 일치
      const leaderVal = ev.leader ?? ev.host ?? ev.hostName ?? ev.manager ?? ev.owner ?? '';
      if (!includesCI(leaderVal, qLeader)) return false; // 모임장
      const memberField = ev.attendees ?? ev.participants ?? ev.members ?? ev.memberNames ?? ev.joiners ?? [];
      if (!includesCI(memberField, qMember)) return false; // 참여자
      if (!includesCI(ev.location, qLocation)) return false; // 위치
      return true;
    });
  }, [events, qLeader, qMember, qLocation, qDate]);

  const anyFilterOn = (qLeader && qLeader.trim()) || (qMember && qMember.trim()) || (qLocation && qLocation.trim()) || (qDate && qDate.trim());

  const resetFilters = () => {
    setQLeader('');
    setQMember('');
    setQLocation('');
    setQDate('');
  };

  return (
    <div className="calendar-container ios">
      {/* 상단 헤더 */}
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

      {/* 달력 */}
      <Calendar
        onChange={setSelectedDate}
        value={selectedDate}
        activeStartDate={activeMonthDate}
        calendarType="gregory"
        locale="ko-KR"
        onActiveStartDateChange={({ activeStartDate, view }) => {
          if (view === 'month' && activeStartDate) setActiveMonthDate(activeStartDate);
        }}
        formatShortWeekday={(l, d) => ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}
        /* 모바일은 '일' 없이 숫자만 */
        formatDay={(locale, date) => (isMobile ? String(date.getDate()) : new Intl.DateTimeFormat('ko-KR', { day: 'numeric' }).format(date))}
        nextLabel={null}
        prevLabel={null}
        next2Label={null}
        prev2Label={null}
        /* 날짜 칸 아래 iOS 배지들 + hover 툴팁
           └ PC: 3줄 높이까지만 보이도록(셀 내부 고정), 초과 시 스크롤 */
        tileContent={({ date, view }) => {
          if (view !== 'month') return null;
          const key = ymd(date);
          const dayEvents = eventsByDate[key] || [];
          const birthdays = birthdaysByMD[key.slice(5, 10)] || [];
          if (!dayEvents.length && !birthdays.length) return null;

          return (
            <div className="ios-badges scrollable">
              {dayEvents.map((ev) => {
                const label = labelOf(ev);
                return (
                  <span key={ev.id} className="ios-badge tip" title={label} data-tip={label}>
                    {label}
                  </span>
                );
              })}
              {birthdays.map((name, i) => {
                const label = `${name} 생일🍰💕`;
                return (
                  <span key={`bd-${key}-${i}`} className="ios-badge birthday tip" title={label} data-tip={label}>
                    {label}
                  </span>
                );
              })}
            </div>
          );
        }}
        tileClassName={({ date, view }) => {
          if (view !== 'month') return '';
          const key = ymd(date);
          const hasBirthday = (birthdaysByMD[key.slice(5, 10)] || []).length > 0;
          return eventsByDate[key]?.length || hasBirthday ? 'has-events' : '';
        }}
      />

      {/* 🔎 필터 바 (달력 아래) */}
      <div className="event-filters below">
        <input className="inp" placeholder="모임장 검색 (예: 홍길동)" value={qLeader} onChange={(e) => setQLeader(e.target.value)} />
        <input className="inp" placeholder="참여자 검색 (예: 김민수)" value={qMember} onChange={(e) => setQMember(e.target.value)} />
        <input className="inp" placeholder="위치 검색 (예: 잠실)" value={qLocation} onChange={(e) => setQLocation(e.target.value)} />
        {/* 라벨 텍스트 없이 날짜만 */}
        <input type="date" className="inp inp-date" value={qDate} onChange={(e) => setQDate(e.target.value)} placeholder="YYYY-MM-DD" />
        <div className="filter-actions">
          <button type="button" className="mini-btn ghost" onClick={resetFilters}>
            초기화
          </button>
        </div>
      </div>

      {/* 선택일 섹션 */}
      <div className="sel-header">
        <h3>
          {selectedKey} 일정 {loading ? '(불러오는 중...)' : ''}
        </h3>
        <button className="mini-btn" onClick={goCreate}>
          + 일정 등록
        </button>
      </div>

      <EventList events={eventsByDate[selectedKey] || []} emptyText="선택한 날짜에 일정이 없습니다." onItemClick={(ev) => navigate(`/event/${ev.id}`)} />

      {/* 월 전체(필터 결과) */}
      <h3 style={{ marginTop: 24 }}>
        {anyFilterOn ? '검색 결과' : '이번 달 전체 일정'} ({filteredMonthEvents.length}건)
      </h3>
      <EventList
        events={filteredMonthEvents}
        emptyText={anyFilterOn ? '검색 조건에 맞는 일정이 없습니다.' : '이번 달 일정이 없습니다.'}
        onItemClick={(ev) => navigate(`/event/${ev.id}`)}
      />
    </div>
  );
}
