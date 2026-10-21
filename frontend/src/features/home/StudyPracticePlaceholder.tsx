import './home.css'

export function StudyPracticePlaceholder() {
  return (
    <section className="family-home study-placeholder">
      <header className="home-hero">
        <p className="eyebrow">Mỗi ngày một chút</p>
        <h1>Học tập &amp; Rèn luyện</h1>
        <p>
          Một góc riêng để học điều mới và chăm sóc bản thân. Nhà mình đang
          chuẩn bị nhé.
        </p>
      </header>
      {[
        {
          title: 'Học tập',
          icon: '📖',
          items: [
            'Mục tiêu học',
            'Môn học',
            'Buổi học',
            'Điểm / bài kiểm tra',
            'Thống kê tuần',
          ],
        },
        {
          title: 'Rèn luyện',
          icon: '🌿',
          items: [
            'Lịch tập',
            'Buổi tập',
            'Mục tiêu tuần',
            'Cân nặng / tiến độ',
          ],
        },
      ].map((section) => (
        <section className="home-card" key={section.title}>
          <h2>
            <span aria-hidden="true">{section.icon} </span>
            {section.title}
          </h2>
          <ul>
            {section.items.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <span className="coming-soon">Sắp có</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
