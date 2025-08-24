// src/pages/MemberDetailPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import { db } from './firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import './MemberDetailPage.css';

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

export default function MemberDetailPage() {
  const { id } = useParams(); // /member/:id
  const navigate = useNavigate();

  const [member, setMember] = useState(null);
  const [attendDates, setAttendDates] = useState([]);
  const [loading, setLoading] = useState(true);

  // 멤버 + 출석 불러오기
  useEffect(() => {
    const load = async () => {
      try {
        const memRef = doc(db, 'members', id);
        const memSnap = await getDoc(memRef);
        if (memSnap.exists()) setMember({ id: memSnap.id, ...memSnap.data() });

        // 출석: attendances에서 memberId == id 로 로드 (date: 'YYYY-MM-DD')
        const qy = query(collection(db, 'attendances'), where('memberId', '==', id));
        const aSnap = await getDocs(qy);
        setAttendDates(aSnap.docs.map((d) => d.data().date).filter(Boolean));
      } catch (e) {
        console.error('멤버 상세 로드 실패', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const attendSet = useMemo(() => new Set(attendDates), [attendDates]);

  if (loading) return <div className="empty">불러오는 중…</div>;
  if (!member) return <div className="empty">존재하지 않는 멤버입니다.</div>;

  return (
    <div className="member-detail">
      <header className="md-head">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="뒤로">
          ← 목록으로
        </button>
        <h1>{member.name} 님 정보</h1>
      </header>

      {/* 인적사항 카드 */}
      <section className="card">
        <div className="md-row">
          <span className="label">이름</span>
          <span>{member.name || '-'}</span>
        </div>
        <div className="md-row">
          <span className="label">생년월일</span>
          <span>{member.birthdate || '-'}</span>
        </div>
        <div className="md-row">
          <span className="label">전화번호</span>
          <button type="button" className="linklike" onClick={() => navigator.clipboard?.writeText(formatPhoneKR(member.phone) || '')} title="전화번호 복사">
            {formatPhoneKR(member.phone) || '-'}
          </button>
        </div>
        <div className="md-row">
          <span className="label">가입일</span>
          <span>{member.joinDate || '-'}</span>
        </div>
        <div className="md-row">
          <span className="label">활동 지역</span>
          <span>{member.activityArea || '-'}</span>
        </div>
        <div className="md-row">
          <span className="label">거주 지역</span>
          <span>{member.residence || '-'}</span>
        </div>
      </section>

      {/* 캘린더: 출석 날짜 점 표시 */}
      <h2>출석 기록</h2>
      <Calendar
        locale="ko-KR"
        calendarType="gregory"
        tileContent={({ date, view }) => {
          if (view !== 'month') return null;
          return attendSet.has(ymd(date)) ? <div className="dot" /> : null;
        }}
      />
      {/* 필요 시, 하단에 출석일 리스트 (옵션) */}
      <ul className="attend-list">
        {attendDates.sort().map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>
  );
}
