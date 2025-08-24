// src/pages/EditEventPage.js
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from './firebase';
import { collection, doc, getDoc, getDocs, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import './CreateEventPage.css';

export default function EditEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState([]);

  const [form, setForm] = useState({
    date: '', // YYYY-MM-DD
    time: '', // HH:mm
    location: '',
    attendees: [], // member ids
    hostId: '',
  });

  // 멤버 + 이벤트 로드
  useEffect(() => {
    (async () => {
      try {
        const [memSnap, evSnap] = await Promise.all([getDocs(collection(db, 'members')), getDoc(doc(db, 'events', id))]);

        const list = memSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setMembers(list);

        if (!evSnap.exists()) {
          alert('일정을 찾을 수 없습니다.');
          navigate(-1);
          return;
        }
        const ev = evSnap.data();
        setForm({
          date: ev.date || '',
          time: ev.time || '',
          location: ev.location || '',
          attendees: ev.attendeesIds || [],
          hostId: ev.hostId || '',
        });
      } catch (e) {
        console.error(e);
        alert('일정 로드 중 오류가 발생했습니다.');
        navigate(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  // id -> name 매핑
  const idToName = useMemo(() => {
    const m = new Map();
    members.forEach((x) => m.set(x.id, x.name || ''));
    return m;
  }, [members]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleAttendee = (mid) => {
    setForm((prev) => {
      const exists = prev.attendees.includes(mid);
      const next = exists ? prev.attendees.filter((x) => x !== mid) : [...prev.attendees, mid];
      return { ...prev, attendees: next };
    });
  };

  const onUpdate = async (e) => {
    e.preventDefault();
    if (!form.date) return alert('날짜를 입력하세요.');
    if (!form.time) return alert('시간을 입력하세요.');
    if (!form.location.trim()) return alert('장소를 입력하세요.');
    if (!form.hostId) return alert('모임장을 선택하세요.');
    if (form.attendees.length === 0) return alert('참석자를 1명 이상 선택하세요.');

    const attendeesIds = Array.from(new Set([...form.attendees, form.hostId]));
    const attendeesNames = attendeesIds.map((mid) => idToName.get(mid) || '');
    const hostName = idToName.get(form.hostId) || '';

    setSaving(true);
    try {
      await updateDoc(doc(db, 'events', id), {
        attendeesIds,
        attendeesNames,
        hostId: form.hostId,
        host: hostName,
        date: form.date,
        time: form.time,
        location: form.location,
        updatedAt: serverTimestamp(),
      });
      alert('수정되었습니다.');
      navigate(-1);
    } catch (err) {
      console.error(err);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    const ok = window.confirm('이 일정을 삭제할까요? 이 동작은 되돌릴 수 없습니다.');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'events', id));
      alert('삭제되었습니다.');
      navigate('/'); // 캘린더 경로에 맞게 수정
    } catch (err) {
      console.error(err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading)
    return (
      <div className="container">
        <h2>🗓️ 일정 수정</h2>
        <div className="form">불러오는 중…</div>
      </div>
    );

  return (
    <div className="container">
      <h2>🗓️ 일정 수정</h2>

      <form onSubmit={onUpdate} className="form">
        <div className="row-two">
          <label className="field">
            <span>날짜</span>
            <input type="date" name="date" value={form.date} onChange={handleChange} required />
          </label>

          <label className="field">
            <span>시간</span>
            <input type="time" name="time" value={form.time} onChange={handleChange} required />
          </label>
        </div>

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
          <div className="help">모임장은 자동으로 참석자에 포함됩니다.</div>
        </div>

        <div className="field">
          <span>참석자(Attendees)</span>
          <div className="attendee-list">
            {members.map((m) => (
              <label key={m.id} className="attendee-item">
                <input type="checkbox" checked={form.attendees.includes(m.id)} onChange={() => toggleAttendee(m.id)} />
                <span>{m.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="actions">
          <button type="button" onClick={() => navigate(-1)}>
            취소
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            삭제
          </button>
          <button type="submit" disabled={saving}>
            저장
          </button>
        </div>
      </form>
    </div>
  );
}
