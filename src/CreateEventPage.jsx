import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, doc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import './CreateEventPage.css';

export default function CreateEventPage() {
  const { state } = useLocation(); // Calendar에서 넘어온 { date }
  const navigate = useNavigate();

  // 멤버 목록(활동 멤버만 보관)
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 참석자 검색어
  const [attendeeQuery, setAttendeeQuery] = useState('');

  // 폼 상태
  const [form, setForm] = useState({
    date: state?.date || '', // YYYY-MM-DD
    time: '', // HH:mm
    location: '',
    attendees: [], // member ids
    hostId: '', // member id
  });

  // === status 헬퍼 ===
  const normalize = (v) => (v ?? '').toString().trim().toLowerCase();
  const WITHDRAWN_SET = useMemo(() => new Set(['탈퇴', 'withdrawn', 'inactive', '퇴회'].map(normalize)), []);

  const isWithdrawn = useCallback(
    (memberOrId) => {
      const m = typeof memberOrId === 'string' ? members.find((x) => x.id === memberOrId) : memberOrId;
      return WITHDRAWN_SET.has(normalize(m?.status));
    },
    [members, WITHDRAWN_SET]
  );

  // 멤버 불러오기 (⚠️ 활동 멤버만 setMembers에 저장)
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'members'), orderBy('name', 'asc')));
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // 활동 멤버만 필터 + 이름 정렬
        const active = raw.filter((m) => !WITHDRAWN_SET.has(normalize(m.status))).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        setMembers(active);

        // 방어: 기존 선택값들 중 활동 멤버에 없는 것 제거
        setForm((prev) => {
          const activeIds = new Set(active.map((m) => m.id));
          const cleanedAttendees = prev.attendees.filter((id) => activeIds.has(id));
          const cleanedHost = activeIds.has(prev.hostId) ? prev.hostId : '';
          return { ...prev, attendees: cleanedAttendees, hostId: cleanedHost };
        });
      } catch (e) {
        console.error('Failed to load members', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 1회

  // id -> name 매핑 (저장 시 denormalize 용)
  const idToName = useMemo(() => {
    const m = new Map();
    members.forEach((x) => m.set(x.id, x.name || ''));
    return m;
  }, [members]);

  // 검색어 정규화
  const norm = (s) => (s || '').toString().trim().toLowerCase();

  // 필터된 멤버 목록 (활동 멤버만 대상)
  const filteredMembers = useMemo(() => {
    const q = norm(attendeeQuery);
    if (!q) return members;
    return members.filter((m) => {
      const name = norm(m.name);
      const nick = norm(m.nickname || '');
      const phone = norm(m.phone || '');
      return name.includes(q) || nick.includes(q) || phone.includes(q);
    });
  }, [members, attendeeQuery]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'hostId') {
      const next = value;
      // members에는 활동 멤버만 있으므로 보통 필요 없지만, 방어적으로 검증
      if (!members.find((m) => m.id === next)) {
        alert('선택할 수 없는 모임장입니다.');
        return;
      }
      setForm((prev) => ({ ...prev, hostId: next }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 참석자 토글
  const toggleAttendee = (id) => {
    // members에는 활동 멤버만 있으므로 항상 선택 가능하지만 방어 로직 유지
    if (!members.find((m) => m.id === id)) return;
    setForm((prev) => {
      const exists = prev.attendees.includes(id);
      const next = exists ? prev.attendees.filter((x) => x !== id) : [...prev.attendees, id];
      return { ...prev, attendees: next };
    });
  };

  const removeAttendee = (id) => {
    setForm((prev) => ({ ...prev, attendees: prev.attendees.filter((x) => x !== id) }));
  };

  // 검색 결과 일괄 선택/해제 (활동 멤버만)
  const selectAllFiltered = () => {
    const selectable = filteredMembers.map((m) => m.id);
    setForm((prev) => {
      const set = new Set(prev.attendees);
      selectable.forEach((id) => set.add(id));
      return { ...prev, attendees: Array.from(set) };
    });
  };
  const clearAllFiltered = () => {
    const filteredIds = new Set(filteredMembers.map((m) => m.id));
    setForm((prev) => ({
      ...prev,
      attendees: prev.attendees.filter((id) => !filteredIds.has(id)),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!form.date) return alert('날짜를 입력하세요.');
    if (!form.time) return alert('시간을 입력하세요.');
    if (!form.location.trim()) return alert('장소를 입력하세요.');
    if (!form.hostId) return alert('모임장을 선택하세요.');
    if (form.attendees.length === 0) return alert('참석자를 1명 이상 선택하세요.');

    setSaving(true);

    // 모임장이 참석자에 없으면 추가
    const attendeesIdsRaw = Array.from(new Set([...form.attendees, form.hostId]));
    // 활동 멤버만 유지(이론상 모두 활동 멤버)
    const activeIds = new Set(members.map((m) => m.id));
    const attendeesIds = attendeesIdsRaw.filter((id) => activeIds.has(id));

    if (attendeesIds.length === 0) {
      setSaving(false);
      return alert('유효한 참석자가 없습니다.');
    }

    const attendeesNames = attendeesIds.map((id) => idToName.get(id) || '');
    const hostName = idToName.get(form.hostId) || '';

    try {
      const batch = writeBatch(db);

      // 1) 이벤트 문서 생성
      const eventRef = doc(collection(db, 'events'));
      batch.set(eventRef, {
        attendeesIds,
        attendeesNames,
        hostId: form.hostId,
        host: hostName,
        date: form.date,
        time: form.time,
        location: form.location,
        createdAt: serverTimestamp(),
      });

      // 2) 참석자들의 attendCount +1
      attendeesIds.forEach((memberId) => {
        const mRef = doc(db, 'members', memberId);
        batch.set(mRef, { attendCount: increment(1) }, { merge: true });
      });

      // 3) 모임장의 hostCount +1
      const hostRef = doc(db, 'members', form.hostId);
      batch.set(hostRef, { hostCount: increment(1) }, { merge: true });

      // 4) 커밋
      await batch.commit();

      alert('일정이 등록되었습니다.');
      navigate(-1); // 이전 페이지(캘린더)로
    } catch (err) {
      console.error(err);
      alert('등록 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const selectedMembers = form.attendees.map((id) => members.find((m) => m.id === id)).filter(Boolean);

  return (
    <div className="container">
      <h2>🗓️ 일정 생성</h2>

      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span>날짜</span>
          <input type="date" name="date" value={form.date} onChange={handleChange} required />
        </label>

        <label className="field">
          <span>시간</span>
          <input type="time" name="time" value={form.time} onChange={handleChange} required />
        </label>

        <label className="field">
          <span>장소</span>
          <input type="text" name="location" placeholder="장소를 입력하세요" value={form.location} onChange={handleChange} required />
        </label>

        <div className="field">
          <span>모임장(Host)</span>
          <select name="hostId" value={form.hostId} onChange={handleChange} required>
            <option value="" disabled>
              모임장을 선택하세요
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* 참석자 검색 + 칩 + 체크박스 목록 */}
        <div className="field">
          <span>참석자(Attendees)</span>

          {/* 검색 UI */}
          <div className="attendee-search">
            <input type="text" placeholder="이름으로 검색" value={attendeeQuery} onChange={(e) => setAttendeeQuery(e.target.value)} />
            <div className="attendee-search-actions">
              <button type="button" onClick={selectAllFiltered} className="mini-btn">
                검색 결과 전체 선택
              </button>
              <button type="button" onClick={clearAllFiltered} className="mini-btn">
                검색 결과 전체 해제
              </button>
            </div>
          </div>

          {/* 선택된 멤버 칩 */}
          <div className="selected-chips">
            {selectedMembers.map((m) => (
              <span key={m.id} className="chip">
                {m.name}
                <button type="button" className="chip-x" onClick={() => removeAttendee(m.id)} aria-label={`${m.name} 제거`}>
                  ×
                </button>
              </span>
            ))}
            {selectedMembers.length === 0 && <span className="help">선택된 참석자가 없습니다.</span>}
          </div>

          {/* 체크박스 목록 (검색 결과 반영) */}
          {loading ? (
            <div>멤버 불러오는 중...</div>
          ) : (
            <div className="attendee-list">
              {filteredMembers.map((m) => {
                const checked = form.attendees.includes(m.id);
                return (
                  <label key={m.id} className="attendee-item">
                    <input type="checkbox" checked={checked} onChange={() => toggleAttendee(m.id)} />
                    <span className="attendee-name">{m.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="actions">
          <button type="button" onClick={() => navigate(-1)} disabled={saving}>
            취소
          </button>
          <button type="submit" disabled={saving}>
            {saving ? '등록 중…' : '등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
