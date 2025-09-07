// src/pages/MemberDetailPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import { db } from './firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import './MemberDetailPage.css';

// ✅ attendanceApi 활용 (조회 전용)
import { getAttendanceDatesSmart } from './utils/attendanceApi';

/** YYYY-MM-DD */
function ymd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 한국식 전화번호 표시
const formatPhoneKR = (v) => {
  const d = (v || '').replace(/\D/g, '');
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
};

// 성별 옵션
const GENDER_OPTIONS = [
  { value: '', label: '선택 안 함' },
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
];

// ✅ 상태(영문 enum) <-> 화면 라벨
const STATUS_OPTIONS = [
  { value: 'active', label: '정상' },
  { value: 'new', label: '신규' },
  { value: 'injured', label: '부상' },
  { value: 'withdrawn', label: '탈퇴' },
];
const statusLabel = (v) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? '-';

export default function MemberDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [member, setMember] = useState(null);
  const [attendDates, setAttendDates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    birthdate: '',
    phone: '',
    joinDate: '',
    activityArea: '',
    residence: '',
    gender: '',
    // ✅ 추가 필드
    status: 'active', // 기본값: active(정상)
    memo: '', // 비고란
    exitDate: null, // 탈퇴일(선택)
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const memSnap = await getDoc(doc(db, 'members', id));
        if (memSnap.exists()) {
          const data = { id: memSnap.id, ...memSnap.data() };
          setMember(data);
          setForm({
            name: data.name ?? '',
            birthdate: data.birthdate ?? '',
            phone: data.phone ?? '',
            joinDate: data.joinDate ?? '',
            activityArea: data.activityArea ?? '',
            residence: data.residence ?? '',
            gender: data.gender ?? '',
            status: data.status ?? 'active', // 없으면 기본 active
            memo: data.memo ?? '',
            exitDate: data.exitDate ?? null,
          });
        }
        const dates = await getAttendanceDatesSmart(id);
        setAttendDates(dates);
      } catch (e) {
        console.error('멤버 상세 로드 실패', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const attendSet = useMemo(() => new Set(attendDates), [attendDates]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const digits = value.replace(/\D/g, '');
      setForm((prev) => ({ ...prev, phone: digits }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const canSave = form.name.trim() && form.birthdate && form.joinDate && /^\d{9,11}$/.test((form.phone || '').replace(/\D/g, ''));

  const handleSave = async () => {
    if (!member || saving || !canSave) return;
    setSaving(true);
    setMsg('');
    try {
      const ref = doc(db, 'members', member.id);

      // ✅ status 변경 감지 → statusUpdatedAt 갱신 / exitDate 자동 처리
      const updates = {
        name: form.name.trim(),
        birthdate: form.birthdate,
        phone: (form.phone || '').replace(/\D/g, ''),
        joinDate: form.joinDate,
        activityArea: form.activityArea || '',
        residence: form.residence || '',
        gender: form.gender || '',
        memo: form.memo || '',
        status: form.status || 'active',
      };

      const prevStatus = member.status ?? 'active';
      const nextStatus = form.status ?? 'active';
      if (prevStatus !== nextStatus) {
        updates.statusUpdatedAt = serverTimestamp();
      }

      // 탈퇴 → exitDate 자동 지정, 탈퇴 해제 → exitDate 비우기
      if (nextStatus === 'withdrawn') {
        updates.exitDate = form.exitDate || ymd(new Date());
      } else if (prevStatus === 'withdrawn' && nextStatus !== 'withdrawn') {
        updates.exitDate = null;
      } else {
        // 수동으로 폼에서 변경한 값 반영(선택)
        updates.exitDate = form.exitDate ?? null;
      }

      await updateDoc(ref, updates);

      setMember({ ...member, ...updates, phone: updates.phone });
      setIsEditing(false);
      setMsg('저장되었습니다.');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      console.error(e);
      setMsg('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!member) return;
    setForm({
      name: member.name ?? '',
      birthdate: member.birthdate ?? '',
      phone: member.phone ?? '',
      joinDate: member.joinDate ?? '',
      activityArea: member.activityArea ?? '',
      residence: member.residence ?? '',
      gender: member.gender ?? '',
      status: member.status ?? 'active',
      memo: member.memo ?? '',
      exitDate: member.exitDate ?? null,
    });
    setIsEditing(false);
    setMsg('');
  };

  if (loading) return <div className="empty">불러오는 중…</div>;
  if (!member) return <div className="empty">존재하지 않는 멤버입니다.</div>;

  return (
    <div className="member-detail">
      <header className="md-head">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="뒤로">
          ← 목록으로
        </button>
        <h1>{member.name} 님 정보</h1>
        <div className="right">
          {!isEditing ? (
            <button className="btn" onClick={() => setIsEditing(true)}>
              수정
            </button>
          ) : (
            <>
              <button className="btn" onClick={handleCancel} disabled={saving}>
                취소
              </button>
              <button className="btn primary" onClick={handleSave} disabled={!canSave || saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </>
          )}
        </div>
      </header>

      <section className="card">
        {/* 이름 */}
        <div className="md-row">
          <span className="label">이름</span>
          {!isEditing ? <span>{member.name || '-'}</span> : <input className="inp" name="name" value={form.name} onChange={handleChange} required />}
        </div>

        {/* 생년월일 */}
        <div className="md-row">
          <span className="label">생년월일</span>
          {!isEditing ? (
            <span>{member.birthdate || '-'}</span>
          ) : (
            <input className="inp" type="date" name="birthdate" value={form.birthdate} onChange={handleChange} required />
          )}
        </div>

        {/* 전화번호 */}
        <div className="md-row">
          <span className="label">전화번호</span>
          {!isEditing ? (
            <button type="button" className="linklike" onClick={() => navigator.clipboard?.writeText(formatPhoneKR(member.phone) || '')}>
              {formatPhoneKR(member.phone) || '-'}
            </button>
          ) : (
            <div className="inline-controls">
              <input
                className="inp"
                name="phone"
                inputMode="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="01012345678"
                pattern="\d{9,11}"
                title="숫자 9~11자리"
                required
              />
              <small className={`hint ${/^\d{9,11}$/.test((form.phone || '').replace(/\D/g, '')) ? 'ok' : ''}`}>숫자만 입력</small>
            </div>
          )}
        </div>

        {/* 가입일 */}
        <div className="md-row">
          <span className="label">가입일</span>
          {!isEditing ? (
            <span>{member.joinDate || '-'}</span>
          ) : (
            <input className="inp" type="date" name="joinDate" value={form.joinDate} onChange={handleChange} required />
          )}
        </div>

        {/* 활동 지역 */}
        <div className="md-row">
          <span className="label">활동 지역</span>
          {!isEditing ? (
            <span>{member.activityArea || '-'}</span>
          ) : (
            <input className="inp" name="activityArea" value={form.activityArea} onChange={handleChange} />
          )}
        </div>

        {/* 거주 지역 */}
        <div className="md-row">
          <span className="label">거주 지역</span>
          {!isEditing ? <span>{member.residence || '-'}</span> : <input className="inp" name="residence" value={form.residence} onChange={handleChange} />}
        </div>

        {/* 성별 */}
        <div className="md-row">
          <span className="label">성별</span>
          {!isEditing ? (
            <span>{member.gender === 'male' ? '남성' : member.gender === 'female' ? '여성' : '-'}</span>
          ) : (
            <select className="inp" name="gender" value={form.gender} onChange={handleChange}>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ✅ 상태 */}
        <div className="md-row">
          <span className="label">상태</span>
          {!isEditing ? (
            <span className={`badge ${member.status || 'active'}`}>{statusLabel(member.status ?? 'active')}</span>
          ) : (
            <select className="inp" name="status" value={form.status} onChange={handleChange}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ✅ 탈퇴일(선택) */}
        <div className="md-row">
          <span className="label">탈퇴일</span>
          {!isEditing ? (
            <span>{member.exitDate || '-'}</span>
          ) : (
            <input className="inp" type="date" name="exitDate" value={form.exitDate || ''} onChange={handleChange} disabled={form.status !== 'withdrawn'} />
          )}
        </div>

        {/* ✅ 비고(memo) */}
        <div className="md-row">
          <span className="label">비고</span>
          {!isEditing ? (
            <span>{member.memo || '-'}</span>
          ) : (
            <textarea className="inp" name="memo" value={form.memo} onChange={handleChange} placeholder="부상/탈퇴 사유 등 메모" rows={3} />
          )}
        </div>

        {msg && (
          <div className="hint" style={{ marginTop: 8 }}>
            {msg}
          </div>
        )}
      </section>

      <h2>출석 기록</h2>
      <Calendar
        locale="ko-KR"
        calendarType="gregory"
        tileContent={({ date, view }) => (view === 'month' && attendSet.has(ymd(date)) ? <div className="dot" /> : null)}
      />

      <ul className="attend-list">
        {attendDates
          .sort((a, b) => a.localeCompare(b))
          .map((d) => (
            <li key={d}>{d}</li>
          ))}
      </ul>
    </div>
  );
}
