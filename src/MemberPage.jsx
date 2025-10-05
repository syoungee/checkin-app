// src/pages/MemberPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
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

// 상태 라벨 맵 (영문 값 → 한글 표시)
const STATUS_LABELS = {
  active: '정상',
  new: '신규',
  injured: '부상',
  withdrawn: '탈퇴',
};

// YYYY-MM-DD
const ymd = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// 이번 달(로컬 기준) 시작/끝 YMD
const getThisMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // 말일
  return { start: ymd(start), end: ymd(end) };
};

function MemberPage() {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // 이번 달 참여 횟수 맵: { [memberId]: number }
  const [monthAttendCounts, setMonthAttendCounts] = useState({});
  const [loadingMonthCount, setLoadingMonthCount] = useState(true);

  // 검색/정렬
  const [qText, setQText] = useState('');
  // ✅ 기본 정렬: 이름 가나다순
  const [sortKey, setSortKey] = useState('nameAsc');

  // ✅ 필터 상태
  const [fActivity, setFActivity] = useState(''); // 부분일치(대소문자 무시)
  const [fResidence, setFResidence] = useState(''); // 부분일치(대소문자 무시)
  const [fGender, setFGender] = useState(''); // '' | 'male' | 'female'
  const [fStatus, setFStatus] = useState(''); // '' | 'active' | 'new' | 'injured' | 'withdrawn'

  // 폼
  const [form, setForm] = useState({
    name: '',
    birthdate: '',
    phone: '',
    activityArea: '',
    residence: '',
    joinDate: '',
    gender: '',
  });

  const fetchMembers = async () => {
    setLoading(true);
    const ref = collection(db, 'members');
    // 서버는 createdAt desc로 가져오고, 화면에서 기본정렬(nameAsc) 적용
    const snap = await getDocs(query(ref, orderBy('createdAt', 'desc')));
    const data = snap.docs.map((doc_) => ({ id: doc_.id, ...doc_.data() }));
    setMembers(data);
    setLoading(false);
  };

  // 이번 달 참여 횟수 집계
  const fetchThisMonthAttendance = async () => {
    setLoadingMonthCount(true);
    try {
      const { start, end } = getThisMonthRange();
      // events 컬렉션에서 이번 달 범위만
      const evRef = collection(db, 'events');
      const evSnap = await getDocs(query(evRef, where('date', '>=', start), where('date', '<=', end), orderBy('date'), orderBy('time')));

      // memberId -> count
      const counter = new Map();
      evSnap.docs.forEach((d) => {
        const ev = d.data();
        const ids = Array.isArray(ev.attendeesIds) ? ev.attendeesIds : [];
        ids.forEach((id) => {
          if (!id) return;
          counter.set(id, (counter.get(id) || 0) + 1);
        });
      });

      // 객체로 변환
      const obj = {};
      for (const [mid, cnt] of counter.entries()) obj[mid] = cnt;
      setMonthAttendCounts(obj);
    } catch (e) {
      console.error('이번 달 참여 횟수 로드 실패:', e);
      setMonthAttendCounts({});
    } finally {
      setLoadingMonthCount(false);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchThisMonthAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const canSubmit = form.name.trim() && form.birthdate && form.joinDate && form.gender && /^\d{9,11}$/.test(form.phone.replace(/\D/g, ''));

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
        status: 'active',
        statusUpdatedAt: serverTimestamp(),
        memo: '',
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
        gender: '',
      });

      await fetchMembers();
      // 데이터 일관성 위해 재계산하려면 아래 주석 해제
      // await fetchThisMonthAttendance();
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

  // 검색 & 정렬 & 필터
  const viewMembers = useMemo(() => {
    const qLower = qText.toLowerCase().trim();
    const aLower = fActivity.toLowerCase().trim();
    const rLower = fResidence.toLowerCase().trim();

    const filtered = members.filter((m) => {
      // 1) 검색어: 이름/전화/활동/거주 포함
      const key = `${m.name ?? ''} ${m.phone ?? ''} ${m.activityArea ?? ''} ${m.residence ?? ''}`.toLowerCase();
      if (qLower && !key.includes(qLower)) return false;

      // 2) 활동지역 필터: 부분일치
      if (aLower) {
        const val = (m.activityArea ?? '').toString().toLowerCase();
        if (!val.includes(aLower)) return false;
      }

      // 3) 거주지역 필터: 부분일치
      if (rLower) {
        const val = (m.residence ?? '').toString().toLowerCase();
        if (!val.includes(rLower)) return false;
      }

      // 4) 성별 필터: 정확히 일치
      if (fGender) {
        if ((m.gender ?? '') !== fGender) return false;
      }

      // 5) ✅ 상태 필터: 정확히 일치
      if (fStatus) {
        if ((m.status ?? 'active') !== fStatus) return false;
      }

      return true;
    });

    // 🔽 정렬: withdrawn(탈퇴)을 항상 맨 뒤로 보낸 다음, 기존 정렬 로직 적용
    const isWithdrawn = (m) => (m.status ?? 'active') === 'withdrawn';

    if (sortKey === 'nameAsc') {
      const collator = new Intl.Collator('ko');
      filtered.sort((a, b) => {
        const aw = isWithdrawn(a) ? 1 : 0;
        const bw = isWithdrawn(b) ? 1 : 0;
        if (aw !== bw) return aw - bw; // withdrawn 뒤로
        return collator.compare(a.name || '', b.name || '');
      });
    } else {
      filtered.sort((a, b) => {
        const aw = isWithdrawn(a) ? 1 : 0;
        const bw = isWithdrawn(b) ? 1 : 0;
        if (aw !== bw) return aw - bw; // withdrawn 뒤로

        const ad = a.joinDate || '';
        const bd = b.joinDate || '';
        if (ad && bd) return bd.localeCompare(ad); // 가입일 최신순
        const at = a.createdAt?.seconds || 0;
        const bt = b.createdAt?.seconds || 0;
        return bt - at;
      });
    }
    return filtered;
  }, [members, qText, sortKey, fActivity, fResidence, fGender, fStatus]);

  const clearFilters = () => {
    setFActivity('');
    setFResidence('');
    setFGender('');
    setFStatus('');
  };

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

      {/* 검색/정렬 + ✅ 필터 */}
      <div className="mem-tools under-form">
        <input className="inp search" placeholder="이름/전화/지역 검색" value={qText} onChange={(e) => setQText(e.target.value)} />

        <select className="inp select" value={sortKey} onChange={(e) => setSortKey(e.target.value)} aria-label="정렬">
          <option value="nameAsc">이름 가나다순</option>
          <option value="joinDateDesc">가입일 최신순</option>
        </select>

        {/* 필터: 활동/거주(부분일치), 성별/상태(정확히 일치) */}
        <input className="inp" placeholder="활동 지역 필터 (예: 판교)" value={fActivity} onChange={(e) => setFActivity(e.target.value)} />
        <input className="inp" placeholder="거주 지역 필터 (예: 송파)" value={fResidence} onChange={(e) => setFResidence(e.target.value)} />

        <select className="inp select" value={fGender} onChange={(e) => setFGender(e.target.value)} aria-label="성별 필터">
          <option value="">성별 전체</option>
          <option value="male">남성만</option>
          <option value="female">여성만</option>
        </select>

        {/* ✅ 상태 필터 */}
        <select className="inp select" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="상태 필터">
          <option value="">상태 전체</option>
          <option value="active">정상</option>
          <option value="new">신규</option>
          <option value="injured">부상</option>
          <option value="withdrawn">탈퇴</option>
        </select>

        <button type="button" className="btn" onClick={clearFilters}>
          필터 초기화
        </button>
      </div>

      <h2 className="list-title">
        연명부 목록 <span className="count">{viewMembers.length}명</span>
      </h2>

      {loading ? (
        <div className="empty">목록을 불러오는 중…</div>
      ) : viewMembers.length === 0 ? (
        <div className="empty">검색/필터 결과가 없습니다.</div>
      ) : (
        <ul className="member-grid">
          {viewMembers.map((m) => {
            const monthCnt = monthAttendCounts[m.id] || 0;
            const monthText = `${monthCnt}회${monthCnt <= 1 ? ' ⚠️' : ''}`; // 0회 또는 1회면 경고 아이콘
            const isNew = (m.status ?? 'active') === 'new';

            return (
              <li key={m.id} className="member-card clickable" onClick={() => navigate(`/member/${m.id}`)} title={`${m.name} 상세 보기`}>
                <div className="mc-head">
                  <strong className="mc-name">
                    {m.name}
                    {isNew && (
                      <span className="new-icon" title="신규" aria-label="신규" style={{ marginLeft: 6 }}>
                        🐹
                      </span>
                    )}
                  </strong>

                  {/* 상태 뱃지 */}
                  <span className={`badge status-${m.status || 'active'}`}>{STATUS_LABELS[m.status] ?? '정상'}</span>

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

                {/* ✅ 이번 달 참여 횟수 (0~1회면 ⚠️ 표시) */}
                <div className="mc-row">
                  <span className="label">참여</span>
                  <span>{loadingMonthCount ? '계산 중…' : monthText}</span>
                </div>

                <div className="mc-row">
                  <span className="label">성별</span>
                  <span>{m.gender === 'male' ? '남성' : m.gender === 'female' ? '여성' : '-'}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default MemberPage;
