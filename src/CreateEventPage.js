// src/pages/CreateEventPage.js
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import './CreateEventPage.css'; // 선택(스타일은 자유)

export default function CreateEventPage() {
  const { state } = useLocation(); // Calendar에서 넘어온 { date }
  const navigate = useNavigate();

  // 멤버 목록
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 폼 상태
  const [form, setForm] = useState({
    date: state?.date || '', // YYYY-MM-DD
    time: '', // HH:mm
    location: '',
    attendees: [], // member ids
    hostId: '', // member id
  });

  // 멤버 불러오기
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const snap = await getDocs(collection(db, 'members'));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // 이름 기준 정렬
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setMembers(list);
      } catch (e) {
        console.error('Failed to load members', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  // id -> name 매핑 (저장 시 denormalize 용)
  const idToName = useMemo(() => {
    const m = new Map();
    members.forEach((x) => m.set(x.id, x.name || ''));
    return m;
  }, [members]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 참석자 토글 (체크박스)
  const toggleAttendee = (id) => {
    setForm((prev) => {
      const exists = prev.attendees.includes(id);
      const next = exists ? prev.attendees.filter((x) => x !== id) : [...prev.attendees, id];
      return { ...prev, attendees: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.date) return alert('날짜를 입력하세요.');
    if (!form.time) return alert('시간을 입력하세요.');
    if (!form.location.trim()) return alert('장소를 입력하세요.');
    if (!form.hostId) return alert('모임장을 선택하세요.');
    if (form.attendees.length === 0) return alert('참석자를 1명 이상 선택하세요.');

    // 모임장이 참석자에 없으면 추가
    const attendeesIds = Array.from(new Set([...form.attendees, form.hostId]));
    const attendeesNames = attendeesIds.map((id) => idToName.get(id) || '');
    const hostName = idToName.get(form.hostId) || '';

    try {
      await addDoc(collection(db, 'events'), {
        // 참조 ID와 이름을 함께 저장 (조회/표시 편의)
        attendeesIds,
        attendeesNames,
        hostId: form.hostId,
        host: hostName,

        // 캡처된 기본 필드 (스크린샷 구조와 맞춤)
        date: form.date, // "2025-08-04"
        time: form.time, // "19:10"
        location: form.location, // "판교 손상원 클라이밍"

        createdAt: serverTimestamp(),
      });

      alert('일정이 등록되었습니다.');
      navigate(-1); // 이전 페이지(캘린더)로
    } catch (err) {
      console.error(err);
      alert('등록 중 오류가 발생했습니다.');
    }
  };

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

        <div className="field">
          <span>참석자(Attendees)</span>
          {loading ? (
            <div>멤버 불러오는 중...</div>
          ) : (
            <div className="attendee-list">
              {members.map((m) => (
                <label key={m.id} className="attendee-item">
                  <input type="checkbox" checked={form.attendees.includes(m.id)} onChange={() => toggleAttendee(m.id)} />
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="actions">
          <button type="button" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="submit">등록</button>
        </div>
      </form>
    </div>
  );
}
