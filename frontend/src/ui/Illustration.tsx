export function HomeIllustration({
  kind,
}: {
  kind: 'parent' | 'member'
}) {
  if (kind === 'parent') {
    return (
      <svg className="home-illustration" viewBox="0 0 180 132" aria-hidden="true">
        <path className="illustration-cloud" d="M18 104c14-22 35-29 57-18 20-27 63-18 68 12 19-3 31 8 36 20H18Z" />
        <path className="illustration-sage" d="M32 107c5-20 18-28 34-30 7 12 6 24-2 35H31Z" />
        <path className="illustration-peach" d="M88 54c0-14 11-25 25-25s25 11 25 25v38H88Z" />
        <circle className="illustration-skin" cx="113" cy="42" r="14" />
        <path className="illustration-ink" d="M99 42c2-12 25-19 30 1-6-4-16-5-30-1Z" />
        <path className="illustration-ink" d="M108 45h1M118 45h1M108 52c4 3 8 3 12 0" />
        <path className="illustration-sage-dark" d="M98 92h42v14H98z" />
        <path className="illustration-cream" d="M75 87h45c4 0 7 3 7 7v10H68V94c0-4 3-7 7-7Z" />
        <path className="illustration-terracotta" d="M75 84h42v5H75z" />
        <path className="illustration-ink" d="M102 78c3-8 9-8 12 0M108 75c-1-9 4-11 7-2" />
        <circle className="illustration-yellow" cx="42" cy="34" r="9" />
        <path className="illustration-yellow" d="m42 18 1 5M42 45l1 5M26 34h5M53 34h5" />
      </svg>
    )
  }
  return (
    <svg className="home-illustration" viewBox="0 0 180 132" aria-hidden="true">
      <path className="illustration-cloud" d="M10 108c10-20 33-27 52-17 11-28 57-28 68 4 19-8 39 3 43 17H10Z" />
      <path className="illustration-lavender" d="M83 50c0-13 11-23 24-23s24 10 24 23v42H83Z" />
      <circle className="illustration-skin" cx="107" cy="39" r="14" />
      <path className="illustration-ink" d="M93 39c2-13 25-18 30 1-7-3-17-4-30-1Z" />
      <path className="illustration-ink" d="M101 43h1M112 43h1M101 50c3 2 7 2 10 0" />
      <path className="illustration-sage-dark" d="M91 88h40v17H91z" />
      <path className="illustration-cream" d="M36 80h50c4 0 7 3 7 7v18H29V87c0-4 3-7 7-7Z" />
      <path className="illustration-peach" d="M29 82h64v8H29z" />
      <path className="illustration-ink" d="M44 100v11M77 100v11M44 111h-8M77 111h8" />
      <path className="illustration-yellow" d="M57 73h10v8H57z" />
      <path className="illustration-yellow" d="M62 58c-5 6-5 10 0 14 5-4 5-8 0-14Z" />
    </svg>
  )
}

export function KitchenIllustration() {
  return (
    <svg className="feature-illustration kitchen-illustration" viewBox="0 0 180 112" aria-hidden="true">
      <path className="illustration-cloud" d="M8 92c14-18 34-23 51-13 12-25 53-25 64 3 19-5 42 5 49 19H8Z" />
      <path className="illustration-sage" d="M26 91c4-18 16-27 31-29 6 11 4 25-4 34H25Z" />
      <path className="illustration-peach" d="M75 64c0-15 12-26 27-26h22v42H75Z" />
      <circle className="illustration-skin" cx="104" cy="31" r="13" />
      <path className="illustration-ink" d="M91 31c4-12 24-17 29 1-7-4-17-4-29-1ZM99 34h1M109 34h1M99 41c3 2 7 2 10 0" />
      <path className="illustration-cream" d="M53 68h91c5 0 9 4 9 9v15H44V77c0-5 4-9 9-9Z" />
      <path className="illustration-terracotta" d="M49 67h99v8H49z" />
      <path className="illustration-sage-dark" d="M71 56c-1-12 6-17 10-20 1 8-1 14-5 20M78 57c5-10 11-12 16-13-2 7-7 12-14 15" />
      <path className="illustration-sage-dark" d="M137 61c5-8 11-10 16-10-2 7-7 11-15 13M143 64c-2-8 1-13 5-17 3 7 0 13-5 17" />
      <path className="illustration-yellow" d="M62 83c8-8 16-8 24 0-7 7-15 7-24 0Z" />
      <path className="illustration-ink" d="M70 83c4-4 8-4 12 0" />
    </svg>
  )
}

export function CalendarIllustration() {
  return (
    <svg className="feature-illustration calendar-illustration" viewBox="0 0 180 112" aria-hidden="true">
      <path className="illustration-cloud" d="M8 92c15-21 37-25 56-13 12-25 53-25 64 3 17-6 40 3 48 18H8Z" />
      <rect className="illustration-sage" x="42" y="27" width="83" height="61" rx="11" />
      <path className="illustration-sage-dark" d="M42 43h83v12H42z" />
      <path className="illustration-cream" d="M56 20v17M111 20v17" />
      <path className="illustration-ink" d="M56 20v17M111 20v17" />
      <circle className="illustration-peach" cx="61" cy="67" r="6" />
      <circle className="illustration-yellow" cx="84" cy="67" r="6" />
      <circle className="illustration-lavender" cx="107" cy="67" r="6" />
      <path className="illustration-ink" d="M72 61h23M72 61l7-7M86 61l7-7" />
      <path className="illustration-terracotta" d="M142 82c0-15 7-28 15-35 3 14 1 27-7 37Z" />
      <path className="illustration-sage-dark" d="M149 86c0-13 7-22 15-28-1 14-5 24-14 31Z" />
    </svg>
  )
}

export function FoodIllustration({ variant = 'breakfast' }: { variant?: 'breakfast' | 'dinner' | 'final' }) {
  const bowlClass = variant === 'dinner' ? 'illustration-peach' : variant === 'final' ? 'illustration-lavender' : 'illustration-sage'
  return (
    <svg className="feature-illustration food-illustration" viewBox="0 0 72 56" aria-hidden="true">
      <path className="illustration-cloud" d="M8 42c4-9 14-12 23-8 5-11 22-11 28 1 5-2 10 1 13 7H8Z" />
      <path className={bowlClass} d="M14 27h44c-2 14-10 21-22 21S16 41 14 27Z" />
      <path className="illustration-terracotta" d="M17 26h38c-3-8-9-12-19-12s-16 4-19 12Z" />
      <path className="illustration-yellow" d="M28 16c-2-6 2-10 6-13 4 4 4 8 0 13M42 16c1-6 5-8 9-9 0 5-3 9-8 11" />
      <circle className="illustration-sage-dark" cx="24" cy="19" r="3" />
      <circle className="illustration-sage-dark" cx="50" cy="19" r="3" />
      <path className="illustration-ink" d="M18 27h36" />
    </svg>
  )
}
