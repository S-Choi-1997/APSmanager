import { useEffect, useMemo, useState } from 'react';
import { auth, onAuthStateChanged } from './auth/authManager';
import Header from './components/Header';
import Footer from './components/Footer';
import LoginPage from './components/LoginPage';
import SearchBar from './components/SearchBar';
import ConsultationTable from './components/ConsultationTable';
import ConsultationModal from './components/ConsultationModal';
import Pagination from './components/Pagination';
import { fetchInquiries, updateInquiry, fetchAttachmentUrls, deleteInquiry } from './services/inquiryService';
import './App.css';

const ITEMS_PER_PAGE = 10;
const BASE_TYPES = ['전체', '비자', '비영리단체', '기업 인허가', '민원 행정', '기타'];

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [consultations, setConsultations] = useState([]);
  const [filteredConsultations, setFilteredConsultations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState('전체');
  const [attachmentMap, setAttachmentMap] = useState({});
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const typeFilters = useMemo(() => {
    const dynamic = Array.from(new Set(consultations.map((c) => c.type).filter(Boolean)));
    const merged = [...BASE_TYPES];
    dynamic.forEach((type) => {
      if (!merged.includes(type)) {
        merged.push(type);
      }
    });
    return merged;
  }, [consultations]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch inquiries from API when user is authenticated
  useEffect(() => {
    if (!user) {
      setConsultations([]);
      setFilteredConsultations([]);
      setLoading(false);
      setAttachmentMap({});
      setSelectedIds(new Set());
      return;
    }

    const loadInquiries = async () => {
      try {
        setLoading(true);
        const data = await fetchInquiries(auth);
        setConsultations(data);
        setFilteredConsultations(data);
        setSelectedIds(new Set());
      } catch (error) {
        console.error('Failed to fetch inquiries:', error);
        alert('상담 목록을 불러오지 못했습니다: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadInquiries();
  }, [user]);

  useEffect(() => {
    let filtered = consultations;

    if (searchTerm.trim() !== '') {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.phone.includes(searchTerm) ||
          c.email.toLowerCase().includes(lower)
      );
    }

    if (showUnreadOnly) {
      filtered = filtered.filter((c) => !c.check);
    }

    if (typeFilter !== '전체') {
      filtered = filtered.filter((c) => c.type === typeFilter);
    }

    setFilteredConsultations(filtered);
    setCurrentPage(1);
  }, [searchTerm, consultations, showUnreadOnly, typeFilter]);

  const totalPages = Math.ceil(filteredConsultations.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentConsultations = filteredConsultations.slice(startIndex, endIndex);

  const handleRespond = async (id, check) => {
    try {
      const newCheckValue = !check;

      // Update via API
      await updateInquiry(id, { check: newCheckValue }, auth);

      // Update local state
      setConsultations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, check: newCheckValue } : c))
      );

      setSelectedConsultation((prev) =>
        prev && prev.id === id ? { ...prev, check: newCheckValue } : prev
      );
    } catch (error) {
      console.error('Failed to update inquiry:', error);
      alert('상담 상태를 업데이트하지 못했습니다: ' + error.message);
    }
  };

  const handleRowClick = async (consultation) => {
    setSelectedConsultation(consultation);

    if (attachmentMap[consultation.id]) {
      return;
    }

    if (!consultation.attachments || consultation.attachments.length === 0) {
      setAttachmentMap((prev) => ({ ...prev, [consultation.id]: [] }));
      return;
    }

    try {
      setAttachmentsLoading(true);
      const urls = await fetchAttachmentUrls(consultation.id, auth);
      setAttachmentMap((prev) => ({ ...prev, [consultation.id]: urls }));
    } catch (error) {
      console.error('Failed to fetch attachments:', error);
      alert('첨부파일을 불러오는 데 실패했습니다: ' + error.message);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedConsultation(null);
  };

  const handleSelectAll = (pageItems, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageItems.forEach((item) => {
        if (checked) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      });
      return next;
    });
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = async (id) => {
    const target = consultations.find((c) => c.id === id);
    const confirmDelete = window.confirm(
      target?.name ? `${target.name} 문의를 삭제하시겠습니까?` : '선택한 문의를 삭제하시겠습니까?'
    );
    if (!confirmDelete) return;

    try {
      await deleteInquiry(id, auth);
      setConsultations((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setAttachmentMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSelectedConsultation((prev) => (prev && prev.id === id ? null : prev));
    } catch (error) {
      console.error('Failed to delete inquiry:', error);
      alert('문의 삭제에 실패했습니다: ' + error.message);
    }
  };

  const handleBulkConfirm = async () => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => updateInquiry(id, { check: true }, auth))
      );
      setConsultations((prev) =>
        prev.map((c) => (selectedIds.has(c.id) ? { ...c, check: true } : c))
      );
      setSelectedConsultation((prev) => (prev && selectedIds.has(prev.id) ? { ...prev, check: true } : prev));
    } catch (error) {
      console.error('Failed to bulk update inquiries:', error);
      alert('선택한 문의 확인 처리에 실패했습니다: ' + error.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmDelete = window.confirm(`${selectedIds.size}건의 문의를 삭제하시겠습니까?`);
    if (!confirmDelete) return;

    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteInquiry(id, auth)));
      setConsultations((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setAttachmentMap((prev) => {
        const next = { ...prev };
        Array.from(selectedIds).forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setSelectedConsultation((prev) => (prev && selectedIds.has(prev.id) ? null : prev));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to bulk delete inquiries:', error);
      alert('선택한 문의 삭제에 실패했습니다: ' + error.message);
    }
  };

  const uncheckedCount = consultations.filter((c) => !c.check).length;

  if (authLoading) {
    return (
      <div className="app">
        <div className="auth-loading">
          <div className="loading-spinner"></div>
          <p>로그인 상태를 확인하고 있습니다.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={setUser} />;
  }

  return (
    <div className="app">
      <Header user={user} />

      <main className="main-content">
        <div className="content-container">
          <div className="content-header">
            <div className="header-left">
              <h2 className="page-title">문의 목록</h2>
              <div className="stats">
                <span className="stat-item">
                  <span className="stat-label">전체</span>
                  <span className="stat-value">{filteredConsultations.length}</span>
                </span>
                <span className="stat-divider">|</span>
                <span className="stat-item">
                  <span className="stat-label">미확인</span>
                  <span className="stat-value unread">{uncheckedCount}</span>
                </span>
              </div>
            </div>
            <div className="header-actions">
              <div className="filter-row">
                <div className="bulk-actions">
                  <button
                    className="bulk-button"
                    onClick={handleBulkConfirm}
                    disabled={selectedIds.size === 0}
                  >
                    선택 확인
                  </button>
                  <button
                    className="bulk-button danger"
                    onClick={handleBulkDelete}
                    disabled={selectedIds.size === 0}
                  >
                    선택 삭제
                  </button>
                </div>
                <button
                  className={`pill-button ${showUnreadOnly ? 'active' : ''}`}
                  onClick={() => setShowUnreadOnly((prev) => !prev)}
                >
                  미확인만 보기
                </button>
                <div className="type-filter-group">
                  {typeFilters.map((type) => (
                    <button
                      key={type}
                      className={`type-filter-btn ${typeFilter === type ? 'active' : ''}`}
                      onClick={() => setTypeFilter(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>문의 목록을 불러오는 중입니다.</p>
            </div>
          ) : filteredConsultations.length === 0 ? (
            <div className="empty-state">
              <p>검색 결과에 해당하는 문의가 없습니다.</p>
            </div>
          ) : (
            <>
              <ConsultationTable
                consultations={currentConsultations}
                onRowClick={handleRowClick}
                onRespond={handleRespond}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onDelete={handleDelete}
              />

              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          )}
        </div>
      </main>

      <Footer />

      {selectedConsultation && (
        <ConsultationModal
          consultation={selectedConsultation}
          attachments={attachmentMap[selectedConsultation.id]}
          attachmentsLoading={attachmentsLoading && !attachmentMap[selectedConsultation.id]}
          onClose={handleCloseModal}
          onRespond={handleRespond}
        />
      )}
    </div>
  );
}

export default App;
