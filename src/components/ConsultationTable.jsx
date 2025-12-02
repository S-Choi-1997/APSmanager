import './ConsultationTable.css';

const TYPE_COLORS = ['#2563eb', '#dc2626', '#f59e0b', '#16a34a']; // blue, red, yellow, green

const getTypeColor = (type = '') => {
  const sum = type.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TYPE_COLORS[sum % TYPE_COLORS.length];
};

const hexToRgba = (hex, alpha) => {
  const sanitized = hex.replace('#', '');
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function ConsultationTable({ consultations, onRowClick, onRespond }) {
  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}.${day} ${hours}:${minutes}`;
  };

  const handleRespond = (e, id, check) => {
    e.stopPropagation();
    onRespond(id, check);
  };

  return (
    <div className="consultation-table-wrapper">
      <table className="consultation-table">
        <colgroup>
          <col className="number-col" />
          <col className="type-col" />
          <col className="name-col" />
          <col className="contact-col" />
          <col className="date-col" />
          <col className="action-col" />
        </colgroup>
        <thead>
          <tr>
            <th className="number-col">번호</th>
            <th className="type-col">분류</th>
            <th className="name-col">성함</th>
            <th className="contact-col">연락처</th>
            <th className="date-col">일시/시간</th>
            <th className="action-col">확인</th>
          </tr>
        </thead>
        <tbody>
          {consultations.map((consultation) => {
            const typeColor = getTypeColor(consultation.type);
            const isUnread = !consultation.check;

            return (
              <tr
                key={consultation.id}
                className={`consultation-row ${isUnread ? 'unread' : 'read'}`}
                onClick={() => onRowClick(consultation)}
              >
                <td className="number-cell number-col">{consultation.number}</td>
                <td className="type-cell type-col">
                  <span
                    className="type-tag"
                    style={{
                      color: typeColor,
                      backgroundColor: hexToRgba(typeColor, 0.12),
                      borderColor: hexToRgba(typeColor, 0.28),
                    }}
                  >
                    {consultation.type}
                  </span>
                </td>
                <td className={`name-cell name-col ${isUnread ? 'bold' : ''}`}>
                  {consultation.name}
                </td>
                <td className="contact-cell contact-col">
                  <div className="contact-phone">{consultation.phone}</div>
                  <div className="contact-email">{consultation.email}</div>
                </td>
                <td className="date-cell date-col">{formatDate(consultation.createdAt)}</td>
                <td className="action-cell action-col">
                  <button
                    className={`respond-btn ${isUnread ? 'unread' : 'responded'}`}
                    onClick={(e) => handleRespond(e, consultation.id, consultation.check)}
                  >
                    {isUnread ? '확인' : '확인 취소'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ConsultationTable;
