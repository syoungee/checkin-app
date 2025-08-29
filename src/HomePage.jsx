import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  return (
    <main className="home">
      <div className="home-shell">
        <header className="home-hero">
          <h1>햄크루 출석부</h1>
          <p className="subtitle">출석 관리와 연명부(멤버) 관리를 간단하고 빠르게.</p>

          <div className="cta-row">
            <Link to="/calendar" className="btn primary lg">
              캘린더 열기
            </Link>
            <Link to="/members" className="btn ghost lg">
              연명부 보기
            </Link>
            <Link to="/awards" className="btn lg">
              시상 보기
            </Link>
          </div>
        </header>

        <section className="cards">
          <Link to="/calendar" className="card link-card" aria-label="캘린더 페이지로 이동">
            <div className="icon">📅</div>
            <h3>캘린더</h3>
            <p>모임 일정과 출석을 한 눈에 확인하고 관리하세요.</p>
          </Link>

          <Link to="/members" className="card link-card" aria-label="연명부 페이지로 이동">
            <div className="icon">👥</div>
            <h3>연명부</h3>
            <p>멤버 등록, 정보 수정, 필터까지 — 깔끔한 명단 관리.</p>
          </Link>

          <Link to="/awards" className="card link-card" aria-label="시상 페이지로 이동">
            <div className="icon">🏆</div>
            <h3>시상</h3>
            <p>기간을 선택해 최다벙참상/최다·최대 벙주상을 자동 집계합니다.</p>
          </Link>
        </section>

        <footer className="home-foot">
          <span>© {new Date().getFullYear()} hamcrew</span>
        </footer>
      </div>
    </main>
  );
}
