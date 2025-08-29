// src/pages/MemberPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './MemberPage.css';

// 한국식 전화번호 표시 포맷팅 (목록 표시 전용)
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

function MemberPage() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // 검색/정렬
  const [qText, setQText] = useState('');
  const [sortKey, setSortKey] = useState('joinDateDesc');

  // 폼
  const [form, setForm] = useState({
    name: '',
    birthdate: '',
    phone: '',
    activityArea: '',
    residence: '',
    joinDate: '',
    gender: '', // ✅ 성별 추가
  });

  const fetchMembers = async () => {
    setLoading(true);
    const ref = collection(db, 'members');
    const snap = await getDocs(query(ref, orderBy('createdAt', 'desc')));
    const data = snap.docs.map((doc_) => ({ id: doc_.id, ...doc_.data() }));
    setMembers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      const digits = value.replace(/\D/g, '');
      setForm((prev) => ({ ...prev, phone: digits }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const canSubmit =
    form.name.trim() &&
    form.birthdate &&
    form.joinDate &&
    form.gender && // ✅ 성별 선택 필수
    /^\d{9,11}$/.test(form.phone.replace(/\D/g, ''));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || saving) return;

    const phoneExists = members.some((m) => (m.phone || '') === form.phone.replace(/\D/g, ''));
    if (phoneExists && !window.confirm('동일한 전화번호가 존재합니다. 그래도 등록할까요?')) return;

    setSaving(true);
    try {
      await addDoc(collection(db, 'members'), {
        ...form,
        phone: form.phone.replace(/\D/g, ''),
        exitDate: null,
        points: 0,
        createdAt: serverTimestamp(),
      });

      setForm({
        name: '',
        birthdate: '',
        phone: '',
        activityArea: '',
        residence: '',
        joinDate: '',
        gender: '', // ✅ 초기화
      });
      await fetchMembers();
    } catch (error) {
      console.error('등록 실패:', error);
      alert('등록에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (deletingId) return;
    const ok = window.confirm(`${name ? `'${name}' ` : ''}항목을 삭제할까요? 이 동작은 되돌릴 수 없습니다.`);
    if (!ok) return;

    try {
      setDeletingId(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
      await deleteDoc(doc(db, 'members', id));
    } catch (err) {
      console.error('삭제 실패:', err);
      alert('삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
      await fetchMembers();
    } finally {
      setDeletingId(null);
    }
  };

  // 검색 & 정렬
  const viewMembers = useMemo(() => {
    const filtered = members.filter((m) => {
      const key = `${m.name ?? ''} ${m.phone ?? ''} ${m.activityArea ?? ''} ${m.residence ?? ''}`.toLowerCase();
      return key.includes(qText.toLowerCase());
    });
    if (sortKey === 'nameAsc') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      filtered.sort((a, b) => {
        const ad = a.joinDate || '';
        const bd = b.joinDate || '';
        if (ad && bd) return bd.localeCompare(ad);
        const at = a.createdAt?.seconds || 0;
        const bt = b.createdAt?.seconds || 0;
        return bt - at;
      });
    }
    return filtered;
  }, [members, qText, sortKey]);

  return (
    <div className="mem-container">
      <header className="mem-head">
        <h1>연명부 등록</h1>
      </header>

      {/* 등록 카드 */}
      <section className="card">
        <form onSubmit={handleSubmit} className="grid fixed-two">
          {/* 1행: 이름 | 생년월일 */}
          <label className="field">
            <span>이름 *</span>
            <input name="name" value={form.name} onChange={handleChange} className="inp" placeholder="예) 홍길동" required />
          </label>

          <label className="field">
            <span>생년월일 *</span>
            <input name="birthdate" type="date" value={form.birthdate} onChange={handleChange} className="inp" required />
          </label>

          {/* 2행: 전화번호 | 가입일 */}
          <label className="field">
            <span>전화번호 *</span>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="inp"
              inputMode="tel"
              placeholder="01012345678"
              pattern="\d{9,11}"
              title="01012345678 형식으로 입력"
              required
            />
            <small className={`hint ${/^\d{9,11}$/.test(form.phone.replace(/\D/g, '')) ? 'ok' : ''}`}>숫자만 입력하세요</small>
          </label>

          <label className="field">
            <span>가입일 *</span>
            <input name="joinDate" type="date" value={form.joinDate} onChange={handleChange} className="inp" required />
          </label>

          {/* 3행: 활동 | 거주 */}
          <label className="field">
            <span>주 활동 지역</span>
            <input name="activityArea" value={form.activityArea} onChange={handleChange} className="inp" placeholder="예) 판교/분당" />
          </label>

          <label className="field">
            <span>거주 지역</span>
            <input name="residence" value={form.residence} onChange={handleChange} className="inp" placeholder="예) 송파" />
          </label>

          {/* 4행: 성별 */}
          <label className="field">
            <span>성별 *</span>
            <select name="gender" value={form.gender} onChange={handleChange} className="inp" required>
              <option value="">선택</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </label>

          {/* 버튼 */}
          <div className="actions">
            <button type="submit" className="btn primary" disabled={!canSubmit || saving}>
              {saving ? '등록 중...' : '등록'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                setForm({
                  name: '',
                  birthdate: '',
                  phone: '',
                  activityArea: '',
                  residence: '',
                  joinDate: '',
                  gender: '',
                })
              }
              disabled={saving}
            >
              초기화
            </button>
          </div>
        </form>
      </section>

      {/* 검색/정렬 */}
      <div className="mem-tools under-form">
        <input className="inp search" placeholder="이름/전화/지역 검색" value={qText} onChange={(e) => setQText(e.target.value)} />
        <select className="inp select" value={sortKey} onChange={(e) => setSortKey(e.target.value)} aria-label="정렬">
          <option value="joinDateDesc">가입일 최신순</option>
          <option value="nameAsc">이름 가나다순</option>
        </select>
      </div>

      <h2 className="list-title">
        연명부 목록 <span className="count">{viewMembers.length}명</span>
      </h2>

      {loading ? (
        <div className="empty">목록을 불러오는 중…</div>
      ) : viewMembers.length === 0 ? (
        <div className="empty">검색 결과가 없습니다.</div>
      ) : (
        <ul className="member-grid">
          {viewMembers.map((m) => (
            <li key={m.id} className="member-card clickable" onClick={() => navigate(`/member/${m.id}`)} title={`${m.name} 상세 보기`}>
              <div className="mc-head">
                <strong className="mc-name">{m.name}</strong>
                {m.activityArea && <span className="chip">{m.activityArea}</span>}
                {m.residence && <span className="chip ghost">{m.residence}</span>}

                {/* 삭제 버튼: 부모 클릭 전파 방지 */}
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label={`${m.name} 삭제`}
                  title="삭제"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(m.id, m.name);
                  }}
                  disabled={deletingId === m.id}
                >
                  {deletingId === m.id ? '삭제 중…' : '×'}
                </button>
              </div>

              <div className="mc-row">
                <span className="label">생일</span>
                <span>{m.birthdate || '-'}</span>
              </div>
              <div className="mc-row">
                <span className="label">입장일</span>
                <span>{m.joinDate || '-'}</span>
              </div>
              <div className="mc-row">
                <span className="label">전화</span>
                <button
                  type="button"
                  className="linklike"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard?.writeText(formatPhoneKR(m.phone) || '');
                  }}
                  title="클립보드에 복사"
                >
                  {formatPhoneKR(m.phone) || '-'}
                </button>
              </div>
              <div className="mc-row">
                <span className="label">성별</span>
                <span>{m.gender === 'male' ? '남성' : m.gender === 'female' ? '여성' : '-'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MemberPage;
