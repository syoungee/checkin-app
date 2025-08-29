import React, { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import './AwardsPage.css';

/** YYYY-MM-DD */
function ymd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 유효한 범위(시작/끝 포함) 만들기 */
function normalizeRange(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const s = new Date(startStr);
  const e = new Date(endStr);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const start = ymd(new Date(Math.min(s, e)));
  const end = ymd(new Date(Math.max(s, e)));
  return { start, end };
}

export default function AwardsPage() {
  // 시작/끝 날짜를 직접 입력
  const [startInput, setStartInput] = useState(() => {
    const end = new Date();
    const start = new Date(end);
    start.setMonth(end.getMonth() - 6); // 기본값: 최근 6개월
    return ymd(start);
  });
  const [endInput, setEndInput] = useState(() => ymd(new Date()));

  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);

  const norm = useMemo(() => normalizeRange(startInput, endInput), [startInput, endInput]);

  // 기간 이벤트 로드
  useEffect(() => {
    const load = async () => {
      if (!norm) return;
      setLoading(true);
      try {
        const qy = query(collection(db, 'events'), where('date', '>=', norm.start), where('date', '<=', norm.end), orderBy('date'), orderBy('time'));
        const snap = await getDocs(qy);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setEvents(list);
      } catch (e) {
        console.error('이벤트 로드 실패', e);
        alert('이벤트를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [norm]);

  // 집계 (정기모임 제외 로직 완전 제거)
  const { attendRank, hostRank, maxEventHosts, maxEventSize } = useMemo(() => {
    const attendMap = new Map(); // memberId -> attend count
    const hostMap = new Map(); // memberId -> host count
    const memberName = new Map(); // memberId -> name (denormalized)

    let maxSize = 0;
    let maxEvents = []; // events with max attendees

    for (const ev of events) {
      const ids = Array.isArray(ev.attendeesIds) ? ev.attendeesIds : [];
      const names = Array.isArray(ev.attendeesNames) ? ev.attendeesNames : [];

      // 이름 인덱스(보고용)
      ids.forEach((id, i) => {
        if (id && names[i]) memberName.set(id, names[i]);
      });
      if (ev.hostId && ev.host) memberName.set(ev.hostId, ev.host);

      // 참석 카운트
      ids.forEach((id) => {
        if (!id) return;
        attendMap.set(id, (attendMap.get(id) || 0) + 1);
      });

      // 호스트 카운트
      if (ev.hostId) hostMap.set(ev.hostId, (hostMap.get(ev.hostId) || 0) + 1);

      // 최대 참석 이벤트 추적
      const size = ids.length;
      if (size > maxSize) {
        maxSize = size;
        maxEvents = [ev];
      } else if (size === maxSize) {
        maxEvents.push(ev);
      }
    }

    const attendRankArr = [...attendMap.entries()]
      .map(([id, cnt]) => ({ id, name: memberName.get(id) || '(무명)', count: cnt }))
      .sort((a, b) => b.count - a.count);

    const hostRankArr = [...hostMap.entries()].map(([id, cnt]) => ({ id, name: memberName.get(id) || '(무명)', count: cnt })).sort((a, b) => b.count - a.count);

    // 최대 참석 이벤트의 벙주들(동률이면 여러 명)
    const maxHosts = [];
    for (const ev of maxEvents) {
      if (!ev.hostId) continue;
      maxHosts.push({
        hostId: ev.hostId,
        hostName: memberName.get(ev.hostId) || ev.host || '(무명)',
        eventId: ev.id,
        date: ev.date,
        time: ev.time,
        location: ev.location,
        attendees: Array.isArray(ev.attendeesNames) ? ev.attendeesNames.length : 0,
      });
    }

    return {
      attendRank: attendRankArr,
      hostRank: hostRankArr,
      maxEventHosts: maxHosts,
      maxEventSize: maxSize,
    };
  }, [events]);

  const startStr = norm?.start ?? '';
  const endStr = norm?.end ?? '';

  const invalidRange = startInput && endInput && new Date(startInput).getTime() > new Date(endInput).getTime();

  return (
    <div className="awards">
      <header className="aw-head">
        <h1>시상 집계</h1>
        <p className="sub">
          기간 내 모임 기록으로 시상을 계산합니다. (데이터 원본: <code>events</code>)
        </p>
      </header>

      <section className="card">
        <h3 className="sec-title">기간 선택</h3>

        <div className="range-side" style={{ display: 'grid', gap: 12, maxWidth: 460 }}>
          <div className="range-summary" style={{ display: 'grid', gap: 8 }}>
            <label className="lbl">
              <strong>시작</strong>
              <input type="date" className="inp" value={startInput} onChange={(e) => setStartInput(e.target.value)} max={endInput || undefined} />
            </label>
            <label className="lbl">
              <strong>종료</strong>
              <input type="date" className="inp" value={endInput} onChange={(e) => setEndInput(e.target.value)} min={startInput || undefined} />
            </label>
            {invalidRange && (
              <div className="hint" style={{ color: 'crimson' }}>
                시작일이 종료일보다 늦을 수 없습니다.
              </div>
            )}
          </div>

          <div className="quick-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn ghost"
              onClick={() => {
                const end = new Date();
                const start = new Date(end);
                start.setMonth(end.getMonth() - 6);
                setStartInput(ymd(start));
                setEndInput(ymd(end));
              }}
            >
              최근 6개월
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                const end = new Date();
                const start = new Date(end.getFullYear(), 0, 1);
                setStartInput(ymd(start));
                setEndInput(ymd(end));
              }}
            >
              올해 전체
            </button>
          </div>

          <div className="range-summary">
            <div>
              <strong>적용 시작</strong> {startStr || '-'}
            </div>
            <div>
              <strong>적용 종료</strong> {endStr || '-'}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="sec-title">시상 결과 {loading ? '(불러오는 중…)' : ''}</h3>

        {/* 최다벙참상 */}
        <div className="award">
          <div className="award-title">
            🏅 최다벙참상 <small>(출석 횟수 1등)</small>
          </div>
          {attendRank.length === 0 ? (
            <div className="empty">기간 내 데이터가 없습니다.</div>
          ) : (
            <ol className="rank">
              {attendRank.slice(0, 5).map((r, i) => (
                <li key={r.id}>
                  <span className="rank-n">{i + 1}</span>
                  <span className="rank-name">{r.name}</span>
                  <span className="rank-count">{r.count}회</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* 최다벙주상 */}
        <div className="award">
          <div className="award-title">
            🏆 최다벙주상 <small>(벙주 횟수 1등)</small>
          </div>
          {hostRank.length === 0 ? (
            <div className="empty">기간 내 데이터가 없습니다.</div>
          ) : (
            <ol className="rank">
              {hostRank.slice(0, 5).map((r, i) => (
                <li key={r.id}>
                  <span className="rank-n">{i + 1}</span>
                  <span className="rank-name">{r.name}</span>
                  <span className="rank-count">{r.count}회</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* 최대벙주상 */}
        <div className="award">
          <div className="award-title">
            🥇 최대벙주상 <small>(참석자 최다 벙의 벙주)</small>
          </div>
          {maxEventSize === 0 ? (
            <div className="empty">기간 내 데이터가 없습니다.</div>
          ) : (
            <>
              <div className="hint">
                가장 많은 참석자 수: <strong>{maxEventSize}명</strong>
              </div>
              <ul className="event-list">
                {maxEventHosts.map((x) => (
                  <li key={x.eventId} className="event-item">
                    <div className="e-line">
                      <span className="chip">벙주</span> <strong>{x.hostName}</strong>
                    </div>
                    <div className="e-meta">
                      <span>
                        {x.date} {x.time || ''}
                      </span>
                      <span className="dot">·</span>
                      <span>{x.location || '-'}</span>
                      <span className="dot">·</span>
                      <span>{x.attendees}명 참석</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
